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

export const DocSpot: React.FC<Props> = ({ clip, currentTime, projectId, clipIndex, isPortrait = false }) => {
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
                parseMarkdown(text, [currentSegment.startWith]);
            } catch (error) {
                console.error('Failed to load document:', error);
            }
        };
        loadDoc();
    }, [clip.docSrc, clip.docs, currentSegment.startWith]);

    // Parse markdown into sections
    const parseMarkdown = (content: string, words: string[]) => {
        const lines = content.split('\n');
        const parsedSections: ParsedSection[] = [];
        let currentSection: ParsedSection | null = null;
        let index = 0;

        const containsAnyWord = (text: string, words: string[]) => {
            const lowerText = text.toLowerCase();
            return words.some(word => {
                const lowerWord = word.toLowerCase();
                // First try exact match (most precise)
                if (lowerText.includes(lowerWord)) return true;

                // Then try matching significant words (length > 3)
                const wordParts = lowerWord.split(/\s+/).filter(part => part.length > 3);
                if (wordParts.length > 0) {
                    // Require at least 2 significant words to match, or 1 if it's very specific
                    const matches = wordParts.filter(part => lowerText.includes(part));
                    return matches.length >= Math.min(2, wordParts.length);
                }

                return false;
            });
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

        const matchingSections = parsedSections.filter(s => s.containsWords);
        console.log(`[DocSpot] Parsed ${parsedSections.length} sections, ${matchingSections.length} contain target words`);
        console.log(`[DocSpot] Target words: ${words.join(', ')}`);
        console.log(`[DocSpot] Matching sections: ${matchingSections.map(s => s.title).join(', ')}`);

        setSections(parsedSections);
        sectionRefs.current = new Array(parsedSections.length);
    };

    // Determine current segment based on speech timing
    useEffect(() => {
        if (!clip.docSegments || clip.docSegments.length <= 1) return;

        if (alignment && alignment.character_start_times_seconds && alignment.characters) {
            // Find which segment's speech content we're currently speaking
            let charIndex = 0;
            for (let i = 0; i < alignment.character_start_times_seconds.length; i++) {
                if (alignment.character_start_times_seconds[i] <= currentTime) {
                    charIndex = i;
                } else {
                    break;
                }
            }

            const spokenText = alignment.characters.slice(0, charIndex + 1).join('');

            // Find which segment contains the currently spoken text
            let newSegmentIndex = 0;
            let accumulatedText = '';

            for (let i = 0; i < clip.docSegments.length; i++) {
                const segment = clip.docSegments[i];
                if (!segment || !segment.speech) continue;

                const segmentText = segment.speech;
                const nextAccumulated = accumulatedText + (i > 0 ? ' ' : '') + segmentText;

                if (spokenText.length <= nextAccumulated.length) {
                    newSegmentIndex = i;
                    break;
                }
                accumulatedText = nextAccumulated;
            }

            if (newSegmentIndex !== currentSegmentIndex) {
                setCurrentSegmentIndex(newSegmentIndex);
            }
        } else {
            // Without alignment, use time-based progression
            const totalDuration = 30; // Assuming 30 seconds total duration
            const segmentDuration = totalDuration / clip.docSegments.length;
            const newSegmentIndex = Math.min(
                Math.floor(currentTime / segmentDuration),
                clip.docSegments.length - 1
            );

            if (newSegmentIndex !== currentSegmentIndex) {
                setCurrentSegmentIndex(newSegmentIndex);
            }
        }
    }, [currentTime, alignment, clip.docSegments, currentSegmentIndex]);

    // Update sections when segment changes
    useEffect(() => {
        if (docContent && currentSegment.startWith) {
            console.log(`[DocSpot] Updating sections for segment ${currentSegmentIndex}: "${currentSegment.startWith}"`);
            parseMarkdown(docContent, [currentSegment.startWith]);
        } else {
            console.log(`[DocSpot] Skipping section update - docContent: ${!!docContent}, startWith: "${currentSegment.startWith}"`);
        }
    }, [docContent, currentSegment.startWith, currentSegmentIndex]);

    // Scroll to section containing the word based on speech progress
    useEffect(() => {
        if (sections.length === 0) return;

        let targetSection = -1;

        // Always try to find the section that contains the current segment's startWith phrase
        if (currentSegment.startWith) {
            targetSection = sections.findIndex((s: ParsedSection) => s.containsWords);

            // If not found by containsWords, try to find by partial text match
            if (targetSection === -1) {
                targetSection = sections.findIndex((s: ParsedSection) => {
                    const searchText = currentSegment.startWith.toLowerCase();
                    return s.title.toLowerCase().includes(searchText) ||
                        s.content.toLowerCase().includes(searchText);
                });
            }
        }

        // If we still haven't found a target, default to the first section
        if (targetSection === -1 && sections.length > 0) {
            targetSection = 0;
        }

        if (targetSection !== -1 && targetSection !== activeSectionIndex) {
            setActiveSectionIndex(targetSection);
            const targetElement = sectionRefs.current[targetSection];
            const container = containerRef.current;

            if (targetElement && container) {
                // Calculate position to center the element
                const relativeTop = targetElement.offsetTop;
                const targetScrollTop = relativeTop - (container.clientHeight / 2) + (targetElement.clientHeight / 2);

                // Custom smooth scroll using requestAnimationFrame for render compatibility
                const startPos = container.scrollTop;
                const endPos = Math.max(0, targetScrollTop);
                const distance = endPos - startPos;
                const durationMs = 800; // 0.8s for smooth slide

                let startTime: number | null = null;

                const easeInOutCubic = (t: number) => {
                    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                };

                const animateScroll = () => {
                    const currentTimestamp = performance.now();
                    if (!startTime) startTime = currentTimestamp;
                    const elapsed = currentTimestamp - startTime;

                    if (elapsed < durationMs && distance !== 0) {
                        const progress = easeInOutCubic(elapsed / durationMs);
                        container.scrollTop = startPos + distance * progress;
                        requestAnimationFrame(animateScroll);
                    } else {
                        container.scrollTop = endPos;
                    }
                };

                requestAnimationFrame(animateScroll);
            }
        }
    }, [currentSegmentIndex, sections, currentSegment.startWith, activeSectionIndex]);

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
