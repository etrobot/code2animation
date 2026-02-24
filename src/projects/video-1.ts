import { VideoClip } from '../types';

export const clips: VideoClip[] = [
  {
    type: 'footagesAroundTitle',
    title: 'CODE\n2\nANIMATION',
    speech: "Code 2 Animation is finally here. Transforming your scripts into cinematic visuals with pure control.",
    media: [
      { src: '/footage/chatbot.html', word: 'Code' },
      { src: '/footage/chatbot.html', word: 'Animation' },
      { src: '/footage/chatbot.html', word: 'cinematic' }
    ]
  },
  {
    type: 'typography',
    title: 'PURE\nCONTROL',
    speech: "Absolute control over every pixel, every transition, and every word.",
  },
  {
    type: 'footagesAroundTitle',
    title: 'AI\nGENERATED',
    speech: "Powered by AI, designed by you. Just write the code, and we'll handle the rest.",
    media: [
      { src: '/footage/chatbot.html', word: 'code' },
      { src: '/footage/chatbot.html', word: 'rest' }
    ]
  },
  {
    type: 'footagesFullScreen',
    title: 'READY?',
    speech: "The future of video generation is here. Experience Code 2 Animation now.",
    media: [
      { src: '/footage/chatbot.html', word: 'future' },
      { src: '/footage/chatbot.html', word: 'experience' },
      { src: '/footage/chatbot.html', word: 'now' }
    ]
  }
];

export const project = {
  name: 'video-1',
  clips
};
