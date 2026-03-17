// src/app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { readdir, access } from 'fs/promises';
import { join, relative } from 'path';

function expandHome(dir: string): string {
  const home = process.env.HOME ?? '';
  return dir.replace(/^~/, home).replace(/^\$HOME/, home);
}

async function findGitProjects(base: string, maxDepth: number): Promise<string[]> {
  const projects: string[] = [];

  async function scan(dir: string, depth: number) {
    if (depth > maxDepth) return;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // skip unreadable directories
    }

    // Check if this directory contains .git (making it a project)
    const hasGit = entries.some((e) => e.name === '.git');
    if (hasGit) {
      const rel = relative(base, dir);
      // Skip if PROJECTS_DIR itself is a git repo (rel would be '')
      if (rel) projects.push(rel);
      return; // don't recurse inside a git project
    }

    // No .git here — recurse into visible, non-node_modules subdirs
    // entry.isDirectory() returns false for symlinks when using withFileTypes,
    // so symlinks are naturally excluded without needing lstat
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;

      await scan(join(dir, entry.name), depth + 1);
    }
  }

  await scan(base, 0);
  return projects.sort();
}

export async function GET() {
  const raw = process.env.PROJECTS_DIR ?? '';
  if (!raw) {
    return NextResponse.json({ baseDir: null, projects: [] });
  }

  const base = expandHome(raw).replace(/\/+$/, '');

  // Verify directory exists
  try {
    await access(base);
  } catch {
    return NextResponse.json({ baseDir: null, projects: [] });
  }

  const projects = await findGitProjects(base, 3);
  return NextResponse.json({ baseDir: base, projects });
}
