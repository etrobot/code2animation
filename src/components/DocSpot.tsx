import React, { useEffect, useState, useRef } from 'react';
import { VideoClip, AudioAlignment, DocSpotSegment } from '../types';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './DocSpot.css';

interface Props {
    clip: VideoClip;
    currentTime: number;
    projectId: string;
    clipIndex: number;
    duration: number;
    isPortrait?: boolean;
}

interface ParsedSection {
    title: string;
    content: string;
    htmlContent: string;
    startIndex: number;
    containsWords: boolean;
}

export const DocSpot: React.FC<Props> = ({ clip, currentTime, projectId, clipIndex, duration, isPortrait = false }) => {
    const [docContent, setDocContent] = useState<string>('');
    const [sections, setSections] = useState<ParsedSection[]>([]);
    const [alignment, setAlignment] = useState<AudioAlignment | null>(null);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0);
    const [activeSectionIndex, setActiveSectionIndex] = useState<number>(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Get current segment based on time or fallback to legacy docs
    const getCurrentSegment = (): { startWith: string, speech: string } => {
        if (clip.docSegments && clip.docSegments.length > 0) {
            // New multi-segment structure
            const segmentIndex = Math.min(currentSegmentIndex, clip.docSegments.length - 1);
            const segment = clip.docSegments[segmentIndex];
            if (segment && segment.startWith && segment.speech) {
                return { startWith: segment.startWith, speech: segment.speech };
            }
        } else if (clip.docs && clip.docs.length > 0) {
            // Legacy single doc structure
            const doc = clip.docs[0];
            if (doc && doc.words) {
                return { startWith: doc.words.join(' '), speech: clip.speech || '' };
            }
        }
        return { startWith: '', speech: '' };
    };

    const currentSegment = getCurrentSegment();

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
            // Get document source from either new or legacy structure
            let docSrc: string | undefined;
            if (clip.docSrc) {
                // New structure with direct docSrc
                docSrc = clip.docSrc;
            } else if (clip.docs && clip.docs.length > 0) {
                // Legacy structure
                docSrc = clip.docs[0].src;
            }

            if (!docSrc) return;

            try {
                const response = await fetch(docSrc);
                if (!response.ok) {
                    console.error(`Failed to load document: ${docSrc}`, response.status);
                    return;
                }
                const text = await response.text();
                setDocContent(text);
                parseMarkdown(text, currentSegment.startWith);
            } catch (error) {
                console.error('Failed to load document:', error);
            }
        };
        loadDoc();
    }, [clip.docSrc, clip.docs, currentSegment.startWith]);

    // Parse markdown into sections
    const parseMarkdown = (content: string, targetPhrase: string) => {
        const lines = content.split('\n');
        const parsedSections: ParsedSection[] = [];
        let currentSection: ParsedSection | null = null;
        let index = 0;

        const containsPhrase = (text: string, phrase: string) => {
            if (!phrase) return false;
            const lowerText = text.toLowerCase();
            const lowerPhrase = phrase.toLowerCase();

            // Try exact match
            if (lowerText.includes(lowerPhrase)) return true;

            // Try matching significant parts (split by space and match at least 2 words if possible)
            const phraseParts = lowerPhrase.split(/\s+/).filter(part => part.length > 3);
            if (phraseParts.length > 0) {
                const matches = phraseParts.filter(part => lowerText.includes(part));
                return matches.length >= Math.min(2, phraseParts.length);
            }
            return false;
        };

        lines.forEach((line) => {
            if (line.startsWith('#')) {
                if (currentSection) {
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
                    containsWords: containsPhrase(title, targetPhrase)
                };
            } else if (currentSection) {
                currentSection.content += line + '\n';
                if (containsPhrase(line, targetPhrase)) {
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

        console.log(`[DocSpot] Parsed ${parsedSections.length} sections for phrase: "${targetPhrase}"`);
        setSections(parsedSections);
        sectionRefs.current = new Array(parsedSections.length);
    };

    // Determine current segment based on speech timing
    useEffect(() => {
        if (!clip.docSegments || clip.docSegments.length <= 1) return;

        if (alignment && (alignment as any).character_start_times_seconds) {
            const { character_start_times_seconds, characters } = alignment as any;

            // Find which character index we're currently at
            let charIndex = 0;
            for (let i = 0; i < character_start_times_seconds.length; i++) {
                if (character_start_times_seconds[i] <= currentTime) {
                    charIndex = i;
                } else {
                    break;
                }
            }

            const spokenText = characters.slice(0, charIndex + 1).join('');
            const spokenClean = spokenText.replace(/\s+/g, '');

            // Find which segment we belong to
            let newSegmentIndex = 0;
            let accumulatedText = '';

            for (let i = 0; i < clip.docSegments.length; i++) {
                const segment = clip.docSegments[i];
                if (!segment || !segment.speech) continue;

                accumulatedText += segment.speech;
                const accumulatedClean = accumulatedText.replace(/\s+/g, '');

                if (spokenClean.length <= accumulatedClean.length) {
                    newSegmentIndex = i;
                    break;
                }
                // If we're at the end, default to the last segment
                newSegmentIndex = i;
            }

            if (newSegmentIndex !== currentSegmentIndex) {
                setCurrentSegmentIndex(newSegmentIndex);
            }
        } else {
            // Fallback: estimate based on duration prop
            const totalDuration = duration || 30;
            const segmentShare = 1 / clip.docSegments.length;
            const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
            const newSegmentIndex = Math.min(
                Math.floor(progress / segmentShare),
                clip.docSegments.length - 1
            );

            if (newSegmentIndex !== currentSegmentIndex) {
                setCurrentSegmentIndex(newSegmentIndex);
            }
        }
    }, [currentTime, alignment, clip.docSegments, currentSegmentIndex, clip.duration]);

    // Update sections when segment changes
    useEffect(() => {
        if (docContent && currentSegment.startWith) {
            parseMarkdown(docContent, currentSegment.startWith);
        }
    }, [docContent, currentSegment.startWith, currentSegmentIndex]);

    // Scroll and Highlight controller
    useEffect(() => {
        if (sections.length === 0 || !containerRef.current) return;

        // Find the correct section to show
        let targetIdx = sections.findIndex(s => s.containsWords);

        // Fallback to title/content search if not tagged by parseMarkdown
        if (targetIdx === -1 && currentSegment.startWith) {
            const search = currentSegment.startWith.toLowerCase();
            targetIdx = sections.findIndex(s =>
                s.title.toLowerCase().includes(search) ||
                s.content.toLowerCase().includes(search)
            );
        }

        // Final fallback
        if (targetIdx === -1) targetIdx = 0;

        if (targetIdx !== -1) {
            setActiveSectionIndex(targetIdx);

            const container = containerRef.current;
            const element = sectionRefs.current[targetIdx];

            if (container && element && container.clientHeight > 0) {
                const targetScroll = Math.max(0, element.offsetTop - (container.clientHeight / 2) + (element.clientHeight / 2));

                // Only animate if far enough away
                if (Math.abs(container.scrollTop - targetScroll) < 10) return;

                const startScroll = container.scrollTop;
                const distance = targetScroll - startScroll;
                const duration = 800;
                let startTime: number | null = null;

                const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                const step = (now: number) => {
                    if (!startTime) startTime = now;
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    container.scrollTop = startScroll + distance * ease(progress);

                    if (progress < 1) {
                        requestAnimationFrame(step);
                    }
                };
                requestAnimationFrame(step);
            }
        }
    }, [sections, currentSegmentIndex, currentSegment.startWith]);

    // Highlight text containing any of the words in HTML
    const highlightHtml = (html: string) => {
        if (!currentSegment.startWith) return html;

        // First try to highlight the exact phrase
        const exactPhrase = currentSegment.startWith;
        const escapedPhrase = exactPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let result = html.replace(
            new RegExp(`(${escapedPhrase})`, 'gi'),
            '<span class="doc-highlight">$1</span>'
        );

        // If no exact match found, try individual significant words
        if (!result.includes('doc-highlight')) {
            const words = exactPhrase.split(/\s+/).filter(word => word.length > 3);
            words.forEach(word => {
                const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`(${escapedWord})`, 'gi');
                result = result.replace(regex, '<span class="doc-highlight">$1</span>');
            });
        }

        return result;
    };

    return (
        <div className={`doc-spot-container ${isPortrait ? 'portrait' : ''}`} ref={containerRef}>
            {/* Debug info - remove in production */}
            <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '8px',
                fontSize: '12px',
                borderRadius: '4px',
                zIndex: 1000
            }}>
                <div>Segment: {currentSegmentIndex + 1}/{clip.docSegments?.length || 0}</div>
                <div>Target: {currentSegment.startWith || 'None'}</div>
                <div>Active Section: {activeSectionIndex + 1}/{sections.length}</div>
                <div>Has docSegments: {clip.docSegments ? 'Yes' : 'No'}</div>
            </div>

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
                        className={`doc-section ${section.containsWords ? 'contains-word' : ''} ${index === activeSectionIndex ? 'active-section' : ''}`}
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
