import { Express, Router } from 'express';

const mounts: Array<{ prefix: string; router: Router }> = [];

export function registerMount(prefix: string, router: Router): void {
  mounts.push({ prefix, router });
}

export function getMounts(): Array<{ prefix: string; router: Router }> {
  return mounts;
}

export function applyMounts(app: Express): void {
  mounts.forEach(({ prefix, router }) => {
    app.use(`/v1${prefix}`, router);
  });
}
