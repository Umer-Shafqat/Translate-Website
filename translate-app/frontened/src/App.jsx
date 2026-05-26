import { useState } from "react";
import "./App.css";
import TranslatorStart from "./components/translatorstart";
import TranslatorApp from "./components/translatorapp";

function App() { 
    const [showTranslatorApp, setShowTranslatorApp] = useState(false);
    
    const handleToggle = () =>{
      setShowTranslatorApp(!showTranslatorApp);
    };
   return (
  <>
    {showTranslatorApp ? (
      <div className="w-[100%] h-[80%] max-w-2xl rounded-2xl shadow-lg shadow-4xl shadow-white bg-[#3d322d]">
        <TranslatorApp onClose={handleToggle} />
      </div>
    ) : (
      <div className="w-[70%] max-w-md rounded-xl shadow-lg shadow-4xl shadow-white bg-[#4a3b35]">
        <TranslatorStart onStart={handleToggle} />
      </div>
    )}
  </>
);
}
export default App;