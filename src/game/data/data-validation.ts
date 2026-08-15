import { FileContainer } from '@/game/resources/file/file-container';
import {
  DataSourceError,
  type DataSourceFileInfo,
  type ResourceDataSource,
} from '@/game/resources/file/resource-data-source';
import {
  EDITION_MANIFESTS,
  type DataFileRequirement,
  type EditionManifest,
} from './edition-manifests';

export type DataIssueSeverity = 'error' | 'warning';
export type DataIssueCode =
  | 'missing'
  | 'case-mismatch'
  | 'unexpected'
  | 'mixed-edition'
  | 'wrong-edition'
  | 'unreadable'
  | 'html-fallback'
  | 'size-mismatch'
  | 'corrupt-container';
export type EditionReadiness = 'ready' | 'incomplete' | 'wrong-edition' | 'corrupt' | 'unreadable';

export interface DataValidationIssue {
  readonly code: DataIssueCode;
  readonly severity: DataIssueSeverity;
  readonly filename?: string;
  readonly message: string;
  readonly correction: string;
}

export interface EditionValidationResult {
  readonly edition: EditionManifest;
  readonly sourceLabel: string;
  readonly readiness: EditionReadiness;
  readonly checkedFiles: number;
  readonly issues: readonly DataValidationIssue[];
}

function normalize(filename: string): string {
  return filename.toLocaleUpperCase('en-US');
}

function findListedFile(
  files: readonly DataSourceFileInfo[],
  wanted: string,
): DataSourceFileInfo | undefined {
  const key = normalize(wanted);
  return files.find((file) => normalize(file.name) === key);
}

function issueForLoadError(error: unknown, requirement: DataFileRequirement): DataValidationIssue {
  if (error instanceof DataSourceError) {
    if (error.code === 'missing') {
      return {
        code: 'missing',
        severity: 'error',
        filename: requirement.name,
        message: `${requirement.name} is missing.`,
        correction: `Copy ${requirement.name} from this edition into its data folder, then recheck.`,
      };
    }
    if (error.code === 'html-fallback') {
      return {
        code: 'html-fallback',
        severity: 'error',
        filename: requirement.name,
        message: `${requirement.name} resolved to an HTML page instead of a DOS data file.`,
        correction: 'Check the static folder path and server fallback rules.',
      };
    }
  }
  return {
    code: 'unreadable',
    severity: 'error',
    filename: requirement.name,
    message: `${requirement.name} could not be read.`,
    correction: 'Choose the folder again or replace the file from a readable original copy.',
  };
}

async function validateRequirement(
  source: ResourceDataSource,
  manifest: EditionManifest,
  requirement: DataFileRequirement,
  listedFiles?: readonly DataSourceFileInfo[],
): Promise<DataValidationIssue[]> {
  const issues: DataValidationIssue[] = [];
  const listed = listedFiles ? findListedFile(listedFiles, requirement.name) : undefined;
  const filename = listed?.name ?? requirement.name;

  if (listedFiles && !listed) {
    return [issueForLoadError(
      new DataSourceError('missing', requirement.name, 'missing'),
      requirement,
    )];
  }
  if (listed && listed.name !== requirement.name) {
    issues.push({
      code: 'case-mismatch',
      severity: 'warning',
      filename: listed.name,
      message: `${listed.name} has different capitalization from ${requirement.name}.`,
      correction: `Rename it to ${requirement.name} for case-sensitive static hosting.`,
    });
  }

  try {
    const reader = await source.loadBinary(manifest.path, filename);
    if (reader.length < requirement.minBytes || reader.length > requirement.maxBytes) {
      issues.push({
        code: 'size-mismatch',
        severity: 'warning',
        filename,
        message: `${filename} is ${reader.length.toLocaleString()} bytes; the known build is ${requirement.minBytes.toLocaleString()} bytes.`,
        correction: 'Keep it if this is a legitimate regional build; replace it if gameplay fails.',
      });
    }
    if (requirement.structure === 'container') {
      try {
        new FileContainer(reader).getPart(0);
      } catch {
        issues.push({
          code: 'corrupt-container',
          severity: 'error',
          filename,
          message: `${filename} does not contain a valid Lemmings data container.`,
          correction: 'Replace it with an undamaged file from the selected edition.',
        });
      }
    }
  } catch (error) {
    issues.push(issueForLoadError(error, requirement));
  }
  return issues;
}

function identifyEditionIssues(
  manifest: EditionManifest,
  listedFiles: readonly DataSourceFileInfo[],
  manifests: readonly EditionManifest[],
): DataValidationIssue[] {
  const listedNames = new Set(listedFiles.map((file) => normalize(file.name)));
  const scores = manifests.map((candidate) => ({
    candidate,
    score: candidate.required.filter((file) => listedNames.has(normalize(file.name))).length,
  }));
  const selected = scores.find(({ candidate }) => candidate.id === manifest.id)?.score ?? 0;
  const bestOther = scores
    .filter(({ candidate }) => candidate.id !== manifest.id)
    .sort((left, right) => right.score - left.score)[0];
  const issues: DataValidationIssue[] = [];

  if (bestOther && bestOther.score >= 3 && bestOther.score > selected) {
    issues.push({
      code: 'wrong-edition',
      severity: 'error',
      message: `This folder looks more like ${bestOther.candidate.name} than ${manifest.name}.`,
      correction: `Select it for ${bestOther.candidate.name}, or choose the ${manifest.name} folder.`,
    });
    return issues;
  }

  const ownNames = new Set([
    ...manifest.required.map((file) => normalize(file.name)),
    ...manifest.optional.map(normalize),
  ]);
  const foreignDistinctive = manifests
    .filter((candidate) => candidate.id !== manifest.id)
    .flatMap((candidate) => candidate.required)
    .find((file) => listedNames.has(normalize(file.name)) && !ownNames.has(normalize(file.name)));
  if (foreignDistinctive && selected > 0) {
    issues.push({
      code: 'mixed-edition',
      severity: 'warning',
      filename: foreignDistinctive.name,
      message: `The folder also contains files associated with another edition, including ${foreignDistinctive.name}.`,
      correction: 'Keep each edition in a separate folder to avoid ambiguous replacements.',
    });
  }
  return issues;
}

function determineReadiness(issues: readonly DataValidationIssue[]): EditionReadiness {
  if (issues.some((issue) => issue.code === 'wrong-edition')) return 'wrong-edition';
  if (issues.some((issue) => issue.code === 'corrupt-container')) return 'corrupt';
  if (issues.some((issue) => issue.code === 'unreadable')) return 'unreadable';
  if (issues.some((issue) => issue.severity === 'error')) return 'incomplete';
  return 'ready';
}

export async function validateEdition(
  source: ResourceDataSource,
  manifest: EditionManifest,
  manifests: readonly EditionManifest[] = EDITION_MANIFESTS,
): Promise<EditionValidationResult> {
  let listedFiles: readonly DataSourceFileInfo[] | undefined;
  const issues: DataValidationIssue[] = [];

  if (source.listFiles) {
    try {
      listedFiles = await source.listFiles(manifest.path);
      issues.push(...identifyEditionIssues(manifest, listedFiles, manifests));
    } catch {
      return {
        edition: manifest,
        sourceLabel: source.label,
        readiness: 'unreadable',
        checkedFiles: 0,
        issues: [{
          code: 'unreadable',
          severity: 'error',
          message: 'The selected folder could not be listed.',
          correction: 'Grant access again or choose a readable folder.',
        }],
      };
    }
  }

  const requirementIssues = await Promise.all(manifest.required.map(
    (requirement) => validateRequirement(source, manifest, requirement, listedFiles),
  ));
  issues.push(...requirementIssues.flat());

  if (listedFiles) {
    const known = new Set([
      ...manifest.required.map((file) => normalize(file.name)),
      ...manifest.optional.map(normalize),
    ]);
    for (const file of listedFiles) {
      if (!known.has(normalize(file.name))) {
        issues.push({
          code: 'unexpected',
          severity: 'warning',
          filename: file.name,
          message: `${file.name} is not used by this edition.`,
          correction: 'It can stay local, but separate edition folders are easier to maintain.',
        });
      }
    }
  }

  return {
    edition: manifest,
    sourceLabel: source.label,
    readiness: determineReadiness(issues),
    checkedFiles: manifest.required.length,
    issues,
  };
}
