import React, { useEffect, useState, useRef } from 'react';
import { VideoClip, AudioAlignment } from '../types';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './DocSpot.css';

interface Props {
    clip: VideoClip;
    currentTime: number;
    projectId: string;
    clipIndex: number;
    duration: number;
}

interface ParsedSection {
    title: string;
    content: string;
    htmlContent: string;
    startIndex: number;
    containsWords: boolean;
}

export const DocSpot: React.FC<Props> = ({ clip, currentTime, projectId, clipIndex }) => {
    const [docContent, setDocContent] = useState<string>('');
    const [sections, setSections] = useState<ParsedSection[]>([]);
    const [currentDocIndex, setCurrentDocIndex] = useState(0);
    const [alignment, setAlignment] = useState<AudioAlignment | null>(null);
    const [highlightWords, setHighlightWords] = useState<string[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Load alignment data
    useEffect(() => {
        const loadAlignment = async () => {
            try {
                const response = await fetch(`/audio/${projectId}/${clipIndex}.json`);
                if (!response.ok) {
                    console.warn('Alignment file not found, DocSpot will work without speech sync');
                    return;
                }
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    console.warn('Alignment file not available (got HTML), DocSpot will work without speech sync');
                    return;
                }
                const data = await response.json();
                setAlignment(data);
            } catch (error) {
                console.warn('Failed to load alignment, DocSpot will work without speech sync:', error);
            }
        };
        loadAlignment();
    }, [projectId, clipIndex]);

    // Load markdown document
    useEffect(() => {
        const loadDoc = async () => {
            if (!clip.docs || clip.docs.length === 0) return;

            const doc = clip.docs[currentDocIndex];
            
            try {
                const response = await fetch(doc.src);
                if (!response.ok) {
                    console.error(`Failed to load document: ${doc.src}`, response.status);
                    return;
                }
                const text = await response.text();
                setDocContent(text);
                setHighlightWords(doc.words);
                parseMarkdown(text, doc.words);
            } catch (error) {
                console.error('Failed to load document:', error);
            }
        };
        loadDoc();
    }, [clip.docs, currentDocIndex]);

    // Parse markdown into sections
    const parseMarkdown = (content: string, words: string[]) => {
        const lines = content.split('\n');
        const parsedSections: ParsedSection[] = [];
        let currentSection: ParsedSection | null = null;
        let index = 0;

        const containsAnyWord = (text: string, words: string[]) => {
            const lowerText = text.toLowerCase();
            return words.some(word => lowerText.includes(word.toLowerCase()));
        };

        lines.forEach((line) => {
            if (line.startsWith('#')) {
                if (currentSection) {
                    // Render markdown content to HTML
                    const htmlContent = DOMPurify.sanitize(marked.parse(currentSection.content) as string);
                    currentSection.htmlContent = htmlContent;
                    parsedSections.push(currentSection);
                }
                const title = line.replace(/^#+\s*/, '');
                currentSection = {
                    title,
                    content: '',
                    htmlContent: '',
                    startIndex: index,
                    containsWords: containsAnyWord(title, words)
                };
            } else if (currentSection) {
                currentSection.content += line + '\n';
                if (containsAnyWord(line, words)) {
                    currentSection.containsWords = true;
                }
            }
            index++;
        });

        if (currentSection) {
            const htmlContent = DOMPurify.sanitize(marked.parse(currentSection.content) as string);
            currentSection.htmlContent = htmlContent;
            parsedSections.push(currentSection);
        }

        setSections(parsedSections);
        sectionRefs.current = new Array(parsedSections.length);
    };

    // Scroll to section containing the word based on speech progress
    useEffect(() => {
        if (sections.length === 0) return;

        // If we have alignment data, sync with speech
        if (alignment && alignment.character_start_times_seconds && alignment.characters && clip.speech) {
            let charIndex = 0;

            for (let i = 0; i < alignment.character_start_times_seconds.length; i++) {
                if (alignment.character_start_times_seconds[i] <= currentTime) {
                    charIndex = i;
                } else {
                    break;
                }
            }

            const spokenText = alignment.characters.slice(0, charIndex + 1).join('').toLowerCase();
            
            // Find if we've spoken any of the highlight words
            const hasSpokenWord = highlightWords.some(word => 
                spokenText.includes(word.toLowerCase())
            );
            
            if (hasSpokenWord) {
                const targetSection = sections.findIndex((s: ParsedSection) => s.containsWords);
                if (targetSection !== -1 && sectionRefs.current[targetSection]) {
                    sectionRefs.current[targetSection]?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }
        } else {
            // Without alignment, scroll to the target section immediately when loaded
            const targetSection = sections.findIndex((s: ParsedSection) => s.containsWords);
            if (targetSection !== -1 && sectionRefs.current[targetSection]) {
                // Small delay to ensure DOM is ready
                setTimeout(() => {
                    sectionRefs.current[targetSection]?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 300);
            }
        }
    }, [currentTime, alignment, clip.speech, sections, highlightWords]);

    // Highlight text containing any of the words in HTML
    const highlightHtml = (html: string) => {
        if (!highlightWords || highlightWords.length === 0) return html;
        
        let result = html;
        highlightWords.forEach(word => {
            const regex = new RegExp(`(${word})`, 'gi');
            result = result.replace(regex, '<span class="doc-highlight">$1</span>');
        });
        return result;
    };

    return (
        <div className="doc-spot-container" ref={containerRef}>
            {sections.length === 0 && (
                <div className="doc-loading">
                    <p>Loading document...</p>
                </div>
            )}
            <div className="doc-content">
                {sections.map((section, index) => (
                    <div
                        key={index}
                        ref={(el) => (sectionRefs.current[index] = el)}
                        className={`doc-section ${section.containsWords ? 'contains-word' : ''}`}
                    >
                        <h2 
                            className="doc-section-title"
                            dangerouslySetInnerHTML={{ 
                                __html: highlightHtml(DOMPurify.sanitize(section.title))
                            }}
                        />
                        <div 
                            className="doc-section-content"
                            dangerouslySetInnerHTML={{ 
                                __html: highlightHtml(section.htmlContent)
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
