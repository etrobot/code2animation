import { useEffect, useRef } from 'react';

interface DeterministicIframeProps {
    src: string;
    className?: string;
    title?: string;
    onLoad?: () => void;
}

export const DeterministicIframe = ({ src, className = '', title, onLoad }: DeterministicIframeProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        // Inject sync script when iframe loads
        const handleLoad = async () => {
            if (!iframeRef.current || !iframeRef.current.contentWindow) return;

            try {
                // Only inject if same-origin (which it should be in this app)
                const doc = iframeRef.current.contentWindow.document;
                
                // Create script element that loads the module
                const scriptEl = doc.createElement('script');
                scriptEl.type = 'module';
                scriptEl.src = '/scripts/animation/main.js';
                doc.head.appendChild(scriptEl);

                // Notify parent that iframe is ready
                if (onLoad) {
                    onLoad();
                }
            } catch (e) {
                console.warn('[DeterministicIframe] Failed to inject sync script (possible cross-origin):', e);
            }
        };

        const iframe = iframeRef.current;
        if (iframe) {
            iframe.addEventListener('load', handleLoad);
            return () => iframe.removeEventListener('load', handleLoad);
        }
    }, [src, onLoad]);

    return (
        <iframe
            ref={iframeRef}
            src={src}
            className={className}
            title={title}
            sandbox="allow-scripts allow-same-origin"
        />
    );
};
