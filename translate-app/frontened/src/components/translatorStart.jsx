function TranslatorStart({onStart}) {
  return <div className="w-full flex flex-col p-6 h-full justify-center items-center">
    <div className="w-full h-64 flex flex-col   p-6 sm:p-12  rounded-t-full rounded-bl-full bg-gradient-to-r from-[#efc8c1] to-[#cba28a]">
       <span className="font-shojumaru text-5xl sm:text-6xl text-brown text-center">Hello</span>
       <span className="text-3xl text-right font-notoSansJP  text-brown sm:text-3xl">Hey</span>
    </div>
    <div className="space-y-5 mt-20 mb-30 w-full flex flex-col justify-end items-end">
      <span className="font-righteous text-4xl text-white uppercase">Translator App</span>
  <button 
  className=" w-32 h-10 rounded-full p-1 bg-gradient-to-r from-[#efc8c1] to-[#cba28a]" onClick={onStart}>
    Start</button>
    </div>
  </div>;
}

export default TranslatorStart;