import React, { useState, useRef } from 'react';
import { Layers, UploadCloud, Download, Trash2, Image as ImageIcon, CheckCircle2, Loader2, FileCode, Camera, Package, Github } from 'lucide-react';
import CardPreview from './components/CardPreview';
import { CardData, ProcessingStatus } from './types';
import { captureElement, downloadImage } from './services/captureService';
import JSZip from 'jszip';

const App: React.FC = () => {
  const [cards, setCards] = useState<CardData[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Reference to the hidden sandbox iframe
  const sandboxRef = useRef<HTMLIFrameElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (files.length > 10) {
      alert("Maximum 10 files allowed at once.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFileName(`${files.length} file${files.length > 1 ? 's' : ''} selected`);
    setStatus(ProcessingStatus.PARSING);
    setCards([]); // Clear previous

    const allCards: CardData[] = [];

    try {
      // Iterate over all uploaded files
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        
        // Extract raw style content (without scoping it yet, we want pure CSS for the sandbox)
        const rawStyles = Array.from(doc.querySelectorAll('style'))
            .map(style => style.innerHTML)
            .join('\n');
        
        // Also prepare scoped styles for the UI preview (so it doesn't break the app)
        const outerStyles = Array.from(doc.querySelectorAll('style')).map(style => style.outerHTML).join('\n');
        const scopedStylesForPreview = outerStyles.replace(/(^|[\s,}])body(?=[\s,{])/ig, '$1.card-preview-scope');

        // Select all div.card elements in this file
        const nodes = Array.from(doc.querySelectorAll('div.card'));
        
        nodes.forEach((node) => {
            const cardHtml = node instanceof HTMLElement ? node.outerHTML : "<div>Invalid Node</div>";
            
            // For Preview: Use scoped styles
            const previewContent = `${scopedStylesForPreview}\n${cardHtml}`;
            
            allCards.push({
                id: Math.random().toString(36).substr(2, 9),
                htmlContent: previewContent,
                styles: rawStyles, // Store raw styles for the sandbox
                loading: true
            });
        });
      }
      
      if (allCards.length === 0) {
        alert("No <div class=\"card\"> elements found in the uploaded file(s).");
        setStatus(ProcessingStatus.IDLE);
        return;
      }

      setCards(allCards);
      setStatus(ProcessingStatus.IDLE); // Ready to process
    } catch (error) {
      console.error("Error parsing files:", error);
      alert("Failed to parse HTML files.");
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const handleProcess = async () => {
    if (cards.length === 0) return;
    const iframe = sandboxRef.current;
    if (!iframe) {
        alert("Sandbox environment not ready.");
        return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    
    // Process sequentially
    for (let i = 0; i < cards.length; i++) {
      setCurrentProcessingIndex(i);
      const card = cards[i];

      // If already captured, skip
      if (card.imageUrl) continue;

      try {
        const doc = iframe.contentWindow?.document;
        if (!doc) throw new Error("Sandbox document not found");

        // 1. Prepare the Sandbox
        // We inject the raw CSS and the Raw HTML into a clean environment.
        // We use 'fit-content' on the wrapper to ensure we capture the card size,
        // but we assume the styles provided handle the internal layout.
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    /* Basic Reset */
                    body { margin: 0; padding: 20px; background: transparent; }
                    /* Injected User Styles */
                    ${card.styles}
                </style>
            </head>
            <body>
                <div id="capture-target" style="display: inline-block; width: fit-content;">
                   ${card.htmlContent.replace(/<style>[\s\S]*?<\/style>/gi, '') /* Remove scoped styles from HTML part since we injected raw styles in head */} 
                </div>
            </body>
            </html>
        `);
        doc.close();

        // 2. Wait for rendering (Images, Fonts, etc.)
        await new Promise(r => setTimeout(r, 2000));

        // 3. Capture
        const elementToCapture = doc.getElementById('capture-target');
        if (!elementToCapture) throw new Error("Target element missing in sandbox");

        const imageUrl = await captureElement(elementToCapture);
        
        if (imageUrl) {
            setCards(prev => prev.map(c => 
                c.id === card.id 
                  ? { ...c, imageUrl, loading: false } 
                  : c
              ));
        } else {
            throw new Error("Capture returned null");
        }

      } catch (error) {
        console.error("Capture error", error);
        setCards(prev => prev.map(c => 
          c.id === card.id 
            ? { ...c, loading: false, error: "Failed to capture image" } 
            : c
        ));
      }
    }

    // Clean up sandbox
    if (iframe.contentWindow?.document) {
        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write("");
        iframe.contentWindow.document.close();
    }

    setCurrentProcessingIndex(-1);
    setStatus(ProcessingStatus.COMPLETED);
  };

  const handleClear = () => {
    setCards([]);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setStatus(ProcessingStatus.IDLE);
  };

  const getFormattedFilename = (index: number) => {
      // padStart(2, '0') ensures 01, 02, ..., 10, 11
      return `card-${String(index + 1).padStart(2, '0')}.png`;
  };

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    let hasImages = false;

    cards.forEach((card, index) => {
      if (card.imageUrl) {
        hasImages = true;
        // Remove the data URL prefix to get raw base64 data for the ZIP
        const base64Data = card.imageUrl.replace(/^data:image\/(png|jpg);base64,/, "");
        const filename = getFormattedFilename(index);
        zip.file(filename, base64Data, { base64: true });
      }
    });

    if (!hasImages) {
        alert("No images captured yet.");
        return;
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cards-bundle.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to generate zip:", error);
      alert("Failed to create zip file.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      
      {/* Hidden Sandbox Iframe for isolated capturing */}
      <iframe 
        ref={sandboxRef}
        id="capture-sandbox"
        title="capture-sandbox"
        style={{ 
            position: 'absolute', 
            top: '-9999px', 
            left: '-9999px', 
            width: '1440px', // Wide enough to prevent mobile layout shifts
            height: '1440px',
            border: 'none',
            pointerEvents: 'none'
        }}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              WebCard Snapper
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-slate-500 hidden sm:block">
              HTML Extraction Tool
            </div>
            <a 
              href="https://github.com/shuidong007-web/WebCardSnapper" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
              title="View on GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Input Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center">
                  <UploadCloud className="w-5 h-5 mr-2 text-indigo-500" />
                  Upload HTML
                </h2>
                <span className="text-xs font-medium bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                  Target: .card
                </span>
              </div>
              
              <p className="text-sm text-slate-500 mb-4">
                Upload up to 10 HTML files. We extract <code>&lt;div class="card"&gt;</code> elements and capture them as <code>card-01.png</code>, etc.
              </p>

              <div 
                className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors flex flex-col items-center justify-center cursor-pointer mb-4 relative"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".html,.htm"
                  className="hidden"
                  multiple
                />
                <FileCode className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm font-medium text-slate-600">
                  {fileName || "Click to upload .html file(s)"}
                </span>
              </div>

              {cards.length > 0 && (
                 <div className="mb-4 text-xs text-slate-500 flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                   <span>Found {cards.length} items</span>
                   <span className="text-indigo-600 font-medium">Ready to capture</span>
                 </div>
              )}

              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleProcess}
                  disabled={status === ProcessingStatus.PROCESSING || cards.length === 0 || (cards.length > 0 && !cards[0].loading)}
                  className={`w-full py-3 px-4 rounded-xl flex items-center justify-center font-semibold text-white transition-all transform active:scale-95
                    ${status === ProcessingStatus.PROCESSING || cards.length === 0 || (cards.length > 0 && !cards[0].loading)
                      ? 'bg-slate-400 cursor-not-allowed' 
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
                    }`}
                >
                  {status === ProcessingStatus.PROCESSING ? (
                    <>
                      <Camera className="w-5 h-5 mr-2 animate-pulse" />
                      Capturing {currentProcessingIndex + 1}/{cards.length}...
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 mr-2" />
                      Start Screenshotting
                    </>
                  )}
                </button>

                {(fileName || cards.length > 0) && status !== ProcessingStatus.PROCESSING && (
                   <button
                   onClick={handleClear}
                   className="w-full py-2 px-4 rounded-xl flex items-center justify-center font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                 >
                   <Trash2 className="w-4 h-4 mr-2" />
                   Clear / Reset
                 </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-indigo-500" />
                Captured Cards
              </h2>
              {cards.some(c => c.imageUrl) && (
                <button
                  onClick={handleDownloadAll}
                  className="flex items-center px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Download All (.zip)
                </button>
              )}
            </div>

            {cards.length === 0 ? (
              <div className="h-96 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                <UploadCloud className="w-16 h-16 mb-4 opacity-20" />
                <p>No HTML loaded.</p>
                <p className="text-sm">Upload file(s) containing <code>.card</code> elements.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8">
                {cards.map((card, idx) => (
                  <div key={card.id} className="space-y-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    {/* Header for the individual card box */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                         <span className="text-xs font-mono text-slate-400">
                           {getFormattedFilename(idx)}
                         </span>
                         <span className={`text-xs font-medium flex items-center ${card.imageUrl ? 'text-green-600' : 'text-slate-400'}`}>
                            {card.loading ? (
                               <span className="flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Pending Capture...</span>
                            ) : card.imageUrl ? (
                               <span className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> Captured</span>
                            ) : (
                               <span>Pending</span>
                            )}
                          </span>
                    </div>

                    {/* The Component Render (Raw HTML) */}
                    <div className="overflow-auto border border-slate-100 rounded-lg bg-slate-50 p-4 flex justify-center">
                        <CardPreview data={card} />
                    </div>
                    
                    {/* Action Bar per Card */}
                    <div className="flex items-center justify-end px-1 pt-2">
                      {card.imageUrl && (
                        <button
                          onClick={() => downloadImage(card.imageUrl!, getFormattedFilename(idx))}
                          className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md flex items-center transition-colors font-medium"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Save Image
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;