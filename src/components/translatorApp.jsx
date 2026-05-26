import {
  IconX,
  IconTransfer,
  IconChevronDown,
  IconMicrophone,
  IconMicrophoneOff,
  IconCamera,
  IconPhoto,
  IconLoader2,
} from "@tabler/icons-react";
import { useRef, useEffect, useState, useCallback } from "react";
import { languages } from "../languageData";

const maxChars = 200;

const ROMAN_URDU_CODE = "roman_urdu";
const ROMAN_URDU_LABEL = "Roman Urdu";

// ── Image Capture Modal ───────────────────────────────────────────────────────
function ImageCaptureModal({ onClose, onImageCaptured, targetLanguageCode, getLanguageLabel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState("choose");
  const [previewSrc, setPreviewSrc] = useState(null);
  const [capturedBase64, setCapturedBase64] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState(null);
  const [translationError, setTranslationError] = useState("");

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  // Attach srcObject after mode="camera" so <video> is mounted
  useEffect(() => {
    if (mode === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => {
        console.error("Video play error:", err);
      });
    }
  }, [mode]);

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setCameraError("Camera permission denied. Please allow camera access.");
      } else {
        setCameraError("Could not access camera: " + err.message);
      }
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreviewSrc(dataUrl);
    setCapturedBase64(dataUrl.split(",")[1]);
    stopStream();
    setMode("preview");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPreviewSrc(dataUrl);
      setCapturedBase64(dataUrl.split(",")[1]);
      setMode("preview");
    };
    reader.readAsDataURL(file);
  };

  // ── Image OCR + Translation via proxy ────────────────────────────────────
  const handleTranslateImage = async () => {
    if (!capturedBase64) return;
    setIsTranslating(true);
    setTranslationError("");
    setTranslationResult(null);

    const targetName = getLanguageLabel(targetLanguageCode);
    const prompt = `You are an expert OCR and translation system.

Step 1: Extract ALL text visible in this image exactly as it appears.
Step 2: Detect the source language of the extracted text.
Step 3: Translate the extracted text into ${targetName}.

Respond ONLY with a JSON object in this exact format (no markdown, no backticks):
{
  "extractedText": "<all text found in the image>",
  "detectedLanguage": "<detected language name in English>",
  "translatedText": "<translation in ${targetName}>"
}

If no readable text is found, set extractedText to "" and translatedText to "No readable text found in image."`;

    try {
      // Sending image as base64 through our backend proxy
      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: capturedBase64,
                  },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      const textBlock = data.content?.find((b) => b.type === "text");
      if (!textBlock?.text) throw new Error("No response from Claude");
      const raw = textBlock.text.trim().replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      setTranslationResult(parsed);
      setMode("result");
    } catch (err) {
      console.error("Image translation error:", err);
      setTranslationError("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleConfirm = () => {
    if (translationResult) {
      onImageCaptured(capturedBase64, previewSrc, translationResult);
      onClose();
    }
  };

  const handleRetake = () => {
    setPreviewSrc(null);
    setCapturedBase64(null);
    setTranslationResult(null);
    setTranslationError("");
    setMode("choose");
    stopStream();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.95)" }}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-gray-800">
        <span className="text-white text-sm font-medium">Scan text in image</span>
        <button onClick={onClose} className="p-1">
          <IconX size={20} className="text-gray-400 hover:text-white" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4 overflow-y-auto py-4">

        {/* Choose mode */}
        {mode === "choose" && (
          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            <p className="text-gray-400 text-xs text-center">
              Take a photo or upload an image — AI will detect the language and translate it.
            </p>
            {cameraError && (
              <p className="text-red-400 text-xs text-center px-2">{cameraError}</p>
            )}
            <div className="flex gap-4 w-full">
              <button
                onClick={startCamera}
                className="flex-1 flex flex-col items-center gap-2 py-6 rounded-xl border border-gray-600 hover:border-[#b6f492] transition-colors"
              >
                <IconCamera size={32} className="text-[#b6f492]" />
                <span className="text-white text-sm">Take photo</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-2 py-6 rounded-xl border border-gray-600 hover:border-[#b6f492] transition-colors"
              >
                <IconPhoto size={32} className="text-[#b6f492]" />
                <span className="text-white text-sm">Upload image</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Camera viewfinder */}
        {mode === "camera" && (
          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            <div className="relative w-full rounded-xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full rounded-xl"
                autoPlay
                playsInline
                muted
              />
              <div className="absolute inset-4 border-2 border-dashed border-[#b6f492] rounded-lg opacity-60 pointer-events-none" />
              <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-[#b6f492] opacity-80">
                Point camera at text to translate
              </p>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full border-4 border-[#b6f492] flex items-center justify-center bg-transparent hover:bg-[#b6f49220] transition-colors flex-shrink-0"
            >
              <div className="w-10 h-10 rounded-full bg-[#b6f492]" />
            </button>
            <p className="text-gray-500 text-xs">Tap to capture</p>
          </div>
        )}

        {/* Preview + Translate button */}
        {mode === "preview" && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <div className="relative w-full rounded-xl overflow-hidden">
              <img
                src={previewSrc}
                alt="Captured"
                className="w-full rounded-xl object-contain max-h-56"
              />
            </div>
            <p className="text-gray-400 text-xs text-center">
              Ready to extract and translate all text in this image.
            </p>
            {translationError && (
              <p className="text-red-400 text-xs text-center">{translationError}</p>
            )}
            <div className="flex gap-3 w-full">
              <button
                onClick={handleRetake}
                className="flex-1 py-2 rounded-full border border-gray-600 text-gray-300 text-sm hover:border-gray-400 transition-colors"
              >
                Retake
              </button>
              <button
                onClick={handleTranslateImage}
                disabled={isTranslating}
                className="flex-1 py-2 rounded-full bg-[#b6f492] text-black text-sm font-semibold hover:bg-[#9de87a] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isTranslating ? (
                  <>
                    <IconLoader2 size={14} className="animate-spin" />
                    Translating…
                  </>
                ) : (
                  <>
                    <IconTransfer size={14} />
                    Translate
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Result screen */}
        {mode === "result" && translationResult && (
          <div className="flex flex-col gap-4 w-full max-w-sm">
            <img
              src={previewSrc}
              alt="Scanned"
              className="w-full rounded-xl object-contain max-h-36"
            />
            {translationResult.detectedLanguage && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Detected:</span>
                <span className="text-xs bg-[#1e2820] text-[#b6f492] px-2 py-0.5 rounded-full">
                  {translationResult.detectedLanguage}
                </span>
                <span className="text-xs text-gray-500">→</span>
                <span className="text-xs bg-[#1e2820] text-[#b6f492] px-2 py-0.5 rounded-full">
                  {getLanguageLabel(targetLanguageCode)}
                </span>
              </div>
            )}
            {translationResult.extractedText && (
              <div className="bg-[#1a1f1a] rounded-xl p-3">
                <p className="text-gray-500 text-xs mb-1">Original text</p>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {translationResult.extractedText}
                </p>
              </div>
            )}
            <div className="bg-[#1e2820] rounded-xl p-3 border border-[#b6f49230]">
              <p className="text-[#b6f492] text-xs mb-1 font-medium">Translation</p>
              <p className="text-[#b6f492] text-sm leading-relaxed">
                {translationResult.translatedText}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 py-2 rounded-full border border-gray-600 text-gray-300 text-sm hover:border-gray-400 transition-colors"
              >
                Scan another
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2 rounded-full bg-[#b6f492] text-black text-sm font-semibold hover:bg-[#9de87a] transition-colors"
              >
                Use translation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Translator Component ─────────────────────────────────────────────────
function TranslatorApp({ onClose }) {
  const [translatedText, setTranslatedText] = useState("");
  const [selectedLanguageFrom, setSelectedLanguageFrom] = useState("en-GB");
  const [selectedLanguageTo, setSelectedLanguageTo] = useState("en-GB");
  const [showLanguages, setShowLanguages] = useState(false);
  const [currentLanguageSelection, setCurrentLanguageSelection] = useState(null);
  const [inputText, setInputText] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImageSrc, setCapturedImageSrc] = useState(null);
  const [isImageTranslating, setIsImageTranslating] = useState(false);
  const [detectedLang, setDetectedLang] = useState("");

  const dropDownRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const selectedLanguageFromRef = useRef(selectedLanguageFrom);
  const selectedLanguageToRef = useRef(selectedLanguageTo);
  useEffect(() => { selectedLanguageFromRef.current = selectedLanguageFrom; }, [selectedLanguageFrom]);
  useEffect(() => { selectedLanguageToRef.current = selectedLanguageTo; }, [selectedLanguageTo]);

  const handleClickOutside = (e) => {
    if (dropDownRef.current && !dropDownRef.current.contains(e.target))
      setShowLanguages(false);
  };
  useEffect(() => {
    if (showLanguages) document.addEventListener("mousedown", handleClickOutside);
    else document.removeEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLanguages]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive")
        mediaRecorderRef.current.stop();
    };
  }, []);

  const getLanguageLabel = (code) => {
    if (code === ROMAN_URDU_CODE) return ROMAN_URDU_LABEL;
    if (languages[code]) return languages[code];
    const prefix = code.split("-")[0].toLowerCase();
    const match = Object.entries(languages).find(
      ([k]) => k.split("-")[0].toLowerCase() === prefix
    );
    return match ? match[1] : code;
  };

  const handleLanguageClick = (type) => {
    setCurrentLanguageSelection(type);
    setShowLanguages(true);
  };

  const handleSwapLanguage = () => {
    if (selectedLanguageTo === ROMAN_URDU_CODE) return;
    setSelectedLanguageFrom(selectedLanguageTo);
    setSelectedLanguageTo(selectedLanguageFrom);
  };

  const handleLanguagesSelect = (languageCode) => {
    if (currentLanguageSelection === "from") {
      setSelectedLanguageFrom(languageCode);
    } else {
      if (languageCode === ROMAN_URDU_CODE) return;
      setSelectedLanguageTo(languageCode);
    }
    setShowLanguages(false);
  };

  const translateWithGoogle = async (text, fromCode, toCode) => {
    const from = fromCode.split("-")[0];
    const to = toCode.split("-")[0];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google Translate error: ${response.status}`);
    const data = await response.json();
    return data[0].map((item) => item[0]).join("");
  };

  // ── Roman Urdu translation via backend proxy ──────────────────────────────
  const translateWithClaude = async (text, targetCode) => {
    const targetName = getLanguageLabel(targetCode);
    const prompt = `You are a professional translator specializing in Roman Urdu (Urdu written in the Latin/Roman alphabet, e.g. "Aap ka haal kaisa hai?" or "Main theek hoon").

Translate the following Roman Urdu text into ${targetName}.

Rules:
- Respond with ONLY the translated text
- No explanations, no notes, no alternatives
- Preserve the meaning and tone accurately
- If translating into Urdu (ur-PK), output in Urdu script (not Roman)

Roman Urdu text to translate:
${text}`;

    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
    const data = await response.json();
    const textBlock = data.content?.find((b) => b.type === "text");
    if (!textBlock?.text) throw new Error("No translation returned from Claude");
    return textBlock.text.trim();
  };

  const handleImageCaptured = useCallback((base64, previewSrc, result) => {
    setCapturedImageSrc(previewSrc);
    setDetectedLang(result.detectedLanguage || "");
    if (result.extractedText) {
      setInputText(result.extractedText.slice(0, maxChars));
      setCharCount(result.extractedText.slice(0, maxChars).length);
    }
    setTranslatedText(result.translatedText || "");
    setVoiceError("");
  }, []);

  const runTranslate = useCallback(async (text, fromCode, toCode) => {
    if (!text?.trim().length) { setTranslatedText(""); return; }
    if (fromCode !== ROMAN_URDU_CODE && fromCode === toCode) {
      setTranslatedText(text);
      return;
    }
    setIsTranslating(true);
    setVoiceError("");
    try {
      let result;
      if (fromCode === ROMAN_URDU_CODE) {
        result = await translateWithClaude(text, toCode);
      } else {
        result = await translateWithGoogle(text, fromCode, toCode);
      }
      setTranslatedText(result);
      setCapturedImageSrc(null);
      setDetectedLang("");
    } catch (err) {
      console.error("Translation error:", err);
      setVoiceError("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const handleTranslate = () => {
    runTranslate(inputText, selectedLanguageFromRef.current, selectedLanguageToRef.current);
  };

  const handleInputTextChange = (e) => {
    const value = e.target.value;
    if (value.length <= maxChars) {
      setInputText(value);
      setCharCount(value.length);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleTranslate(); }
  };

  const getSpeechLang = (code) => {
    if (code === ROMAN_URDU_CODE) return "ur-PK";
    const map = {
      "en-GB": "en-GB", "en-US": "en-US", "ur-PK": "ur-PK", "ar-SA": "ar-SA",
      "fr-FR": "fr-FR", "de-DE": "de-DE", "es-ES": "es-ES", "zh-CN": "zh-CN",
      "hi-IN": "hi-IN", "tr-TR": "tr-TR", "fa-IR": "fa-IR", "ru-RU": "ru-RU",
      "ja-JP": "ja-JP", "ko-KR": "ko-KR", "pt-PT": "pt-PT", "it-IT": "it-IT",
      "pa-IN": "pa-IN",
    };
    return map[code] || code;
  };

  const startMediaRecorder = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsListening(false);
        setVoiceError(
          "Voice captured! Your browser is on HTTP — mic transcription needs HTTPS. " +
          "Please type your text, or open this app on https:// for full voice support."
        );
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
      setVoiceError("");
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setVoiceError("Microphone permission denied. Please allow mic access.");
      } else {
        setVoiceError("Could not access microphone: " + err.message);
      }
    }
  }, []);

  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
  }, []);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (recognitionRef.current) recognitionRef.current.abort();
    setVoiceError("");

    const recognition = new SpeechRecognition();
    recognition.lang = getSpeechLang(selectedLanguageFromRef.current);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => { setIsListening(true); setVoiceError(""); };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputText((prev) => {
        const combined = prev ? `${prev} ${transcript}` : transcript;
        const trimmed = combined.slice(0, maxChars);
        setCharCount(trimmed.length);
        runTranslate(trimmed, selectedLanguageFromRef.current, selectedLanguageToRef.current);
        return trimmed;
      });
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") {
      } else if (event.error === "network") {
        setIsListening(false);
        startMediaRecorder();
        return;
      } else if (event.error === "not-allowed") {
        setVoiceError("Microphone permission denied. Please allow mic access in browser settings.");
      } else {
        setVoiceError(`Mic error: ${event.error}`);
      }
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [runTranslate, startMediaRecorder]);

  const handleVoiceToggle = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      stopMediaRecorder();
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      startSpeechRecognition();
    } else {
      startMediaRecorder();
    }
  };

  const dropdownLanguages =
    currentLanguageSelection === "from"
      ? [[ROMAN_URDU_CODE, ROMAN_URDU_LABEL], ...Object.entries(languages)]
      : Object.entries(languages);

  const inputPlaceholder =
    selectedLanguageFrom === ROMAN_URDU_CODE
      ? `Type Roman Urdu here (e.g. "Aap ka naam kya hai?") or tap 🎙...`
      : `Type in ${getLanguageLabel(selectedLanguageFrom)} or tap 🎙 to speak...`;

  return (
    <div className="w-full flex flex-col gap-y-4 justify-center items-center px-6 sm:px-8 pt-8 pb-4 relative">
      <button className="absolute top-2 right-2">
        <IconX className="text-xl text-white" onClick={onClose} />
      </button>

      {showCamera && (
        <ImageCaptureModal
          onClose={() => setShowCamera(false)}
          onImageCaptured={handleImageCaptured}
          targetLanguageCode={selectedLanguageTo}
          getLanguageLabel={getLanguageLabel}
        />
      )}

      {/* Language selector bar */}
      <div className="w-full min-h-20 flex justify-center items-center px-4 bg-gradient-to-r from-[#41463f] to-[#354041] text-white rounded-lg">
        <div className="language" onClick={() => handleLanguageClick("from")}>
          {getLanguageLabel(selectedLanguageFrom)}
        </div>
        <IconTransfer className="text-2xl mx-8" onClick={handleSwapLanguage} />
        <div className="language" onClick={() => handleLanguageClick("to")}>
          {getLanguageLabel(selectedLanguageTo)}
        </div>
      </div>

      {/* Dropdown */}
      {showLanguages && (
        <div
          ref={dropDownRef}
          className="bg-gradient-to-r from-[#435737] to-[#338b93] w-[calc(100%-4rem)] h-[calc(80%-6rem)] absolute top-36 left-8 z-10 rounded shadow-lg p-4 overflow-y-scroll scrollbar-hide"
        >
          <ul>
            {dropdownLanguages.map(([code, name]) => (
              <li
                key={code}
                className="cursor-pointer hover:bg[#10646b] transition duration-200 p-2 rounded"
                onClick={() => handleLanguagesSelect(code)}
              >
                {name}
              </li>
            ))}
            <li />
          </ul>
        </div>
      )}

      {/* Input textarea + mic + camera */}
      <div className="w-full relative">
        <textarea
          value={inputText || ""}
          onChange={handleInputTextChange}
          className="textarea text-gray-200"
          onKeyDown={handleKeyDown}
          placeholder={inputPlaceholder}
        />
        <div className="absolute bottom-2 right-4 text-gray-400 text-xs">
          {charCount}/{maxChars}
        </div>
        <button
          onClick={handleVoiceToggle}
          title={isListening ? "Stop" : `Speak in ${getLanguageLabel(selectedLanguageFrom)}`}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all
            ${isListening
              ? "bg-red-500 text-white animate-pulse"
              : "bg-[#3c4338] text-gray-300 hover:bg-[#4a5245]"
            }`}
        >
          {isListening ? <IconMicrophoneOff size={16} /> : <IconMicrophone size={16} />}
        </button>
        <button
          onClick={() => setShowCamera(true)}
          title="Translate text from image"
          className="absolute top-12 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-[#3c4338] text-gray-300 hover:bg-[#4a5245] transition-colors"
        >
          <IconCamera size={16} />
        </button>
      </div>

      {/* Captured image thumbnail */}
      {capturedImageSrc && (
        <div className="w-full flex items-center gap-3 bg-[#1e2820] rounded-lg px-3 py-2">
          <img
            src={capturedImageSrc}
            alt="Scanned"
            className="w-12 h-12 object-cover rounded-md flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[#b6f492] text-xs font-medium">Image scanned</p>
            {detectedLang && (
              <p className="text-gray-400 text-xs truncate">
                Detected: {detectedLang} → {getLanguageLabel(selectedLanguageTo)}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setCapturedImageSrc(null);
              setDetectedLang("");
              setTranslatedText("");
            }}
            className="text-gray-500 hover:text-gray-300 flex-shrink-0"
          >
            <IconX size={14} />
          </button>
        </div>
      )}

      {voiceError && (
        <p className="text-red-400 text-xs w-full px-1 leading-relaxed">{voiceError}</p>
      )}

      {isListening && (
        <p className="text-green-400 text-xs w-full px-1 animate-pulse">
          🎙 Listening in {getLanguageLabel(selectedLanguageFrom)}...
        </p>
      )}
      {!isListening && isTranslating && (
        <p className="text-yellow-400 text-xs w-full px-1 animate-pulse">
          ⏳ Translating...
        </p>
      )}
      {isImageTranslating && (
        <div className="flex items-center gap-2 w-full px-1">
          <IconLoader2 size={14} className="text-[#b6f492] animate-spin" />
          <p className="text-[#b6f492] text-xs animate-pulse">
            Reading image and translating...
          </p>
        </div>
      )}

      <button
        onClick={handleTranslate}
        className="w-12 h-12 bg-gradient-to-r from-[#3c4338] to-[#253536] rounded-full text-2xl text-white flex justify-center items-center active:translate-y-[1px]"
      >
        <IconChevronDown />
      </button>

      <div className="w-full">
        <textarea
          value={translatedText}
          className="textarea text-[#b6f492]"
          readOnly
        />
      </div>
    </div>
  );
}

export default TranslatorApp;
