/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SERVICIO: projectBackupService.ts
 * Respaldo Completo y Restauración del Proyecto BIM en formato JSON nativo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type { BuildingProject } from '../models/architecture/BuildingProject';

export function exportProjectToJson(project: BuildingProject): string {
  const exportPayload = {
    app: 'RelevadorBIM',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    project
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function downloadProjectJson(project: BuildingProject): void {
  const jsonStr = exportProjectToJson(project);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const sanitizedName = (project.meta.name || 'relevamiento')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 30);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizedName}_${new Date().toISOString().slice(0, 10)}.bim.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseProjectJson(jsonStr: string): BuildingProject {
  const parsed = JSON.parse(jsonStr);
  const project = parsed.project || parsed;

  if (!project || !project.meta || !Array.isArray(project.levels) || !Array.isArray(project.walls)) {
    throw new Error('El archivo seleccionado no corresponde a un proyecto válido de RelevadorBIM.');
  }

  return project as BuildingProject;
}
