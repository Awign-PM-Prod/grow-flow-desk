import React from "react";

interface HighlightedTextProps {
  text: string | null | undefined;
  searchTerm: string;
}

/**
 * Highlights matching text in a string
 * @param text The text to highlight
 * @param searchTerm The search term to highlight
 * @returns JSX element with highlighted text
 */
export function HighlightedText({ text, searchTerm }: HighlightedTextProps): React.ReactNode {
  if (!text || !searchTerm) return text || "";
  
  const textStr = String(text);
  const searchLower = searchTerm.toLowerCase();
  const textLower = textStr.toLowerCase();
  
  if (!textLower.includes(searchLower)) return textStr;
  
  const parts = textStr.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  
  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === searchLower ? (
          <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

