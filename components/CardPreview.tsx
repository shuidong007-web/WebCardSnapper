import React from 'react';
import { CardData } from '../types';
import { AlertCircle } from 'lucide-react';

interface CardPreviewProps {
  data: CardData;
}

const CardPreview: React.FC<CardPreviewProps> = ({ data }) => {
  // We use an ID here specifically for html2canvas to find this element
  const elementId = `card-capture-${data.id}`;

  if (data.error) {
    return (
      <div className="w-full h-32 rounded-xl border border-red-200 bg-red-50 flex flex-col items-center justify-center text-red-500 p-4 text-center">
        <AlertCircle className="w-8 h-8 mb-2" />
        <span className="text-sm font-medium">Capture Failed</span>
        <span className="text-xs mt-1 text-red-400">{data.error}</span>
      </div>
    );
  }

  // Use fit-content so the container wraps tightly around the card (450x600)
  // Remove padding/margin/background so nothing extra is captured
  const containerStyle: React.CSSProperties = {
    width: 'fit-content',
    height: 'fit-content',
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'transparent',
    overflow: 'visible', // Ensure shadows or glows aren't clipped if they are part of the card
  };

  return (
    <div className="inline-block transform origin-top-left scale-75 md:scale-100">
      {/* 
        Container for capture. 
        Uses the scoped class to apply extracted styles (fonts, etc) 
        without affecting the global document.
      */}
      <div
        id={elementId}
        className="card-preview-scope"
        style={containerStyle}
      >
        {/* Render the raw content. The .card inside will define dimensions. */}
        <div 
            dangerouslySetInnerHTML={{ __html: data.htmlContent }} 
        />
      </div>
    </div>
  );
};

export default CardPreview;