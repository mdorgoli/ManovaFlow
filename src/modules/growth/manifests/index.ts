import { beautyflowManifest } from "./beautyflow";
import { briefflowManifest } from "./briefflow";
import { serviceflowManifest } from "./serviceflow";
import type { VerticalManifest } from "./types";

export const growthManifests = Object.freeze({
  serviceflow: serviceflowManifest,
  beautyflow: beautyflowManifest,
  briefflow: briefflowManifest
} satisfies Record<VerticalManifest["key"], VerticalManifest>);

export type { VerticalManifest } from "./types";
