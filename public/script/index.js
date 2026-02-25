import { project as video1 } from './video-1.js';

export const projects = {
  'video-1': video1
};

if (typeof window !== 'undefined') {
  window.projectsFromScript = projects;
}
