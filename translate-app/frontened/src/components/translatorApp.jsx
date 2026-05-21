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

/* ───────────────────────── IMAGE MODAL ───────────────────────── */

function ImageCaptureModal({
  onClose,
  onImageCaptured,
  targetLanguageCode,
  getLanguageLabel,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState("choose");
  const [previewSrc, setPreviewSrc] = useState(null);
  const [capturedBase64, setCapturedBase64] = useState(null);

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

  useEffect(() => {
    if (mode === "camera" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play();
    }
  }, [mode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setMode("camera");
    } catch (err) {
      console.log(err);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    canvas.getContext("2d").drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreviewSrc(dataUrl);
    setCapturedBase64(dataUrl.split(",")[1]);

    stopStream();
    setMode("preview");
  };

  const handleTranslateImage = async () => {
    setIsTranslating(true);
    setTranslationError("");

    try {
      const prompt = `
Extract text from image and translate into ${getLanguageLabel(
        targetLanguageCode
      )}. Return JSON only:
{"extractedText":"","detectedLanguage":"","translatedText":""}
`;

      const response = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

      const data = await response.json();
      const text = data.content?.[0]?.text || "{}";
      const result = JSON.parse(text.replace(/```json|```/g, ""));

      setTranslationResult(result);
      setMode("result");
    } catch (err) {
      setTranslationError("Translation failed");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleConfirm = () => {
    onImageCaptured(capturedBase64, previewSrc, translationResult);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 text-white p-4">
      <div className="flex justify-between">
        <span>Scan Image</span>
        <IconX onClick={onClose} />
      </div>

      {mode === "choose" && (
        <div className="mt-10 flex gap-4">
          <button onClick={startCamera}>Camera</button>
          <button onClick={() => fileInputRef.current.click()}>
            Upload
          </button>
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files[0];
              const reader = new FileReader();
              reader.onload = (ev) => {
                setPreviewSrc(ev.target.result);
                setCapturedBase64(ev.target.result.split(",")[1]);
                setMode("preview");
              };
              reader.readAsDataURL(file);
            }}
          />
        </div>
      )}

      {mode === "camera" && (
        <>
          <video ref={videoRef} autoPlay className="w-full" />
          <canvas ref={canvasRef} className="hidden" />
          <button onClick={capturePhoto}>Capture</button>
        </>
      )}

      {mode === "preview" && (
        <>
          <img src={previewSrc} className="w-full" />
          <button onClick={handleTranslateImage}>
            {isTranslating ? "Translating..." : "Translate"}
          </button>
        </>
      )}

      {mode === "result" && translationResult && (
        <>
          <p>{translationResult.extractedText}</p>
          <p>{translationResult.translatedText}</p>
          <button onClick={handleConfirm}>Use</button>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── MAIN APP ───────────────────────── */

export default function TranslatorApp({ onClose }) {
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");

  const [fromLang, setFromLang] = useState("en-GB");
  const [toLang, setToLang] = useState("ur-PK");

  const ROMAN_URDU_CODE = "roman_urdu";

  /* FIXED TRANSLATION LOGIC */
  const runTranslate = async (text, from, to) => {
    if (!text.trim()) return;

    try {
      let result = "";

      if (from === ROMAN_URDU_CODE || to === ROMAN_URDU_CODE) {
        result = text; // backend handles Roman Urdu (or API)
      } else {
        const res = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${text}`
        );
        const data = await res.json();
        result = data[0].map((i) => i[0]).join("");
      }

      setTranslatedText(result);
    } catch (err) {
      setTranslatedText("Error");
    }
  };

  return (
    <div className="p-4 text-white">
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        className="w-full p-2 text-black"
      />

      <button
        onClick={() => runTranslate(inputText, fromLang, toLang)}
        className="bg-green-500 p-2 mt-2"
      >
        Translate
      </button>

      <div className="mt-4 text-green-300">{translatedText}</div>
    </div>
  );
}