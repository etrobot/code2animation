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
    const [showAvatar, setShowAvatar] = useState(false);
    const [showGradient, setShowGradient] = useState(false);
    const [showName, setShowName] = useState(false);
    const [showHandle, setShowHandle] = useState(false);
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        // 先重置所有状态
        setShowAvatar(false);
        setShowGradient(false);
        setShowName(false);
        setShowHandle(false);
        setShowContent(false);

        if (currentTime < 0.2 || currentTime >= duration - 0.5) {
            return;
        }

        const relativeTime = currentTime - 0.2;
        
        // 0s: 渐变特效先出现并开始旋转
        if (relativeTime >= 0) {
            setShowGradient(true);
        }
        
        // 0.2s: 头像在渐变中淡入 + 名字开始打字机效果
        if (relativeTime >= 0.2) {
            setShowAvatar(true);
            setShowName(true);
        }
        
        // 1.0s: 渐变特效消失 + ID开始打字机效果 + 推文内容淡入
        if (relativeTime >= 1.0) {
            setShowGradient(false);
            setShowHandle(true);
            setShowContent(true);
        }
    }, [currentTime, duration]);

    if (!clip.tweet) return null;

    const { avatar, name, handle, content } = clip.tweet;
    
    // 检查是否应该显示整个组件
    const shouldShow = currentTime >= 0.2 && currentTime < duration - 0.5;
    
    if (!shouldShow) return null;

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
        <div className={`tweet-container ${isPortrait ? 'portrait' : ''}`}>
            <div className="tweet-card">
                <div className="tweet-header">
                    <div className="avatar-container">
                        <img 
                            src={avatar} 
                            alt={name} 
                            className={`tweet-avatar ${showAvatar ? 'avatar-visible' : ''}`} 
                        />
                        <div className={`gradient-overlay ${showGradient ? 'gradient-visible spinning' : ''}`}></div>
                    </div>
                    <div className="tweet-user-info">
                        <div className={`tweet-name ${showName ? 'name-typing' : ''}`}>{name}</div>
                        <div className={`tweet-handle ${showHandle ? 'handle-typing' : ''}`}>{handle}</div>
                    </div>
                </div>
                <div className={`tweet-content ${showContent ? 'content-visible' : ''}`}>
                    {renderContent(content)}
                </div>
            </div>
        </div>
    );
};
