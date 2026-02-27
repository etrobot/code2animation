import React, { useEffect, useState } from 'react';
import { VideoClip } from '../types';
import './Tweet.css';

interface Props {
    clip: VideoClip;
    currentTime: number;
    projectId: string;
    clipIndex: number;
    duration: number;
    isPortrait?: boolean;
}

export const Tweet: React.FC<Props> = ({ clip, currentTime, duration, isPortrait }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Animation logic:
        // Fade in after 0.2s
        // Stay visible until duration - 0.5s
        if (currentTime > 0.2 && currentTime < duration - 0.5) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [currentTime, duration]);

    if (!clip.tweet) return null;

    const { avatar, name, handle, content } = clip.tweet;

    // Simple parser for mentions and hashtags
    const renderContent = (text: string) => {
        const parts = text.split(/(@\w+|#\w+|https?:\/\/[^\s]+)/g);
        return parts.map((part, index) => {
            if (part.startsWith('@') || part.startsWith('#')) {
                return <span key={index} style={{ color: '#1d9bf0' }}>{part}</span>;
            }
            if (part.startsWith('http')) {
                return <span key={index} style={{ color: '#1d9bf0' }}>{part}</span>;
            }
            return part;
        });
    };

    return (
        <div className={`tweet-container ${isPortrait ? 'portrait' : ''} ${isVisible ? 'visible' : ''}`}>
            <div className="tweet-card">
                <div className="tweet-header">
                    <img src={avatar} alt={name} className="tweet-avatar" />
                    <div className="tweet-user-info">
                        <div className="tweet-name">{name}</div>
                        <div className="tweet-handle">{handle}</div>
                    </div>
                </div>
                <div className="tweet-content">
                    {renderContent(content)}
                </div>
            </div>
        </div>
    );
};
