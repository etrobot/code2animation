import { useState, useEffect } from 'react';

export function useProject(initialProject: string) {
  const [projects, setProjects] = useState<any>({});
  const [activeProject, setActiveProject] = useState<string>(initialProject);
  const [isLoadingProject, setIsLoadingProject] = useState(true);

  // Load project JSON dynamically
  useEffect(() => {
    const loadProject = async () => {
      try {
        setIsLoadingProject(true);
        const response = await fetch(`/projects/${activeProject}/${activeProject}.json`);
        if (response.ok) {
          const projectData = await response.json();
          
          // Process background path: convert file to full path
          const processedProject = {
            ...projectData,
            background: projectData.background 
              ? `/projects/${activeProject}/footage/${projectData.background}`
              : projectData.background
          };
          
          setProjects((prev: any) => ({ ...prev, [activeProject]: processedProject }));
        } else {
          console.error(`Failed to load project ${activeProject}`);
        }
      } catch (error) {
        console.error('Error loading project:', error);
      } finally {
        setIsLoadingProject(false);
      }
    };
    
    if (activeProject && !projects[activeProject]) {
      loadProject();
    } else {
      setIsLoadingProject(false);
    }
  }, [activeProject, projects]);

  return {
    projects,
    activeProject,
    setActiveProject,
    isLoadingProject,
    currentProject: activeProject ? projects[activeProject] : null
  };
}