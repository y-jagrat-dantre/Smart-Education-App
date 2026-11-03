import { extractStudyPoints } from '@/features/learning/content';
import type { StudyArtifactContent, StudyArtifactKind } from '@/state/app-store';

export const artifactKinds: { kind: StudyArtifactKind; title: string; description: string; icon: string; color: string; tint: string }[] = [
  { kind: 'slides', title: 'Slide deck', description: 'Turn key facts into complete, visual slide cards.', icon: 'albums-outline', color: '#0F766E', tint: '#E4F2EE' },
  { kind: 'mindmap', title: 'Mind map', description: 'Explore a visual map of connected ideas and details.', icon: 'git-network-outline', color: '#41734C', tint: '#E8F2E5' },
  { kind: 'audio', title: 'Audio overview', description: 'Make a two-host review script from your sources.', icon: 'headset-outline', color: '#A85A32', tint: '#FDF0E3' },
  { kind: 'video', title: 'Scene illustrations', description: 'Generate a gallery of lesson scenes with AI illustrations.', icon: 'images-outline', color: '#397290', tint: '#E7F0F4' },
];

function group<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function compactHeading(point: string, index: number) {
  const words = point.replace(/[.!?]+$/, '').split(/\s+/).slice(0, 6).join(' ');
  return words.length < point.length ? `${words}…` : `Key idea ${index + 1}`;
}

export function makeLocalArtifact(kind: StudyArtifactKind, title: string, subject: string, sourceText: string): StudyArtifactContent {
  const points = extractStudyPoints(sourceText);
  if (!points.length) throw new Error('Add a few complete note statements before creating a study artifact.');

  const topic = title.trim() || subject.trim() || 'Your study notes';
  const summary = `${points.length} key ${points.length === 1 ? 'idea' : 'ideas'} from ${topic}. Review each item against the original source.`;

  if (kind === 'slides') {
    const sections = group(points, 2).map((items, index) => {
      const start = index * 2;
      return {
        heading: index === 0 ? 'The big ideas' : `Key ideas · ${String(index + 1).padStart(2, '0')}`,
        body: items.join('\n\n'),
        sourcePoints: items.map((_, offset) => start + offset + 1),
      };
    });
    return { summary, sections: [{ heading: topic, body: `${subject || 'Study overview'}\n${summary}`, sourcePoints: [] }, ...sections] };
  }

  if (kind === 'mindmap') {
    const categories: { label: string; pattern: RegExp }[] = [
      { label: 'Base quantities and units', pattern: /base unit|fundamental quantit|\blength\b|\bmass\b|\btime\b|electric current|temperature|amount of substance|luminous intensity/i },
      { label: 'Measurement systems', pattern: /system of units|historical system|\bCGS\b|\bMKS\b|\bFPS\b|\bSI\b|international system/i },
      { label: 'Derived quantities', pattern: /derived unit|combination of base|derived quantit/i },
      { label: 'Supplementary units', pattern: /supplementary|radian|steradian|plane angle|solid angle/i },
      { label: 'Dimensions and analysis', pattern: /dimension|dimensional analysis/i },
      { label: 'Precision and measurement', pattern: /significant figure|precision|uncertainty|measurement error/i },
    ];
    const branches = new Map<string, { points: string[]; indexes: number[] }>();
    points.forEach((point, index) => {
      const category = categories.find((item) => item.pattern.test(point))?.label ?? 'Key ideas';
      const branch = branches.get(category) ?? { points: [], indexes: [] };
      branch.points.push(point);
      branch.indexes.push(index + 1);
      branches.set(category, branch);
    });
    return {
      summary,
      sections: [...branches.entries()].map(([heading, branch]) => ({
        heading,
        body: `${branch.points.length} related ${branch.points.length === 1 ? 'idea' : 'ideas'} from the notes.`,
        sourcePoints: branch.indexes,
        children: branch.points.map((point, index) => {
          const sourcePoint = branch.indexes[index] ?? index + 1;
          return {
            heading: compactHeading(point, sourcePoint - 1),
            body: point,
            sourcePoints: [sourcePoint],
          };
        }),
      })),
    };
  }

  if (kind === 'audio') {
    const lines = points.map((point, index) => `${index % 2 === 0 ? 'Host 1' : 'Host 2'}: ${point}`);
    return {
      summary,
      sections: [
        { heading: 'Welcome', body: `Host 1: Welcome to this study overview of ${topic}.\nHost 2: We’ll use the notes you provided and keep the key facts close to their source.`, sourcePoints: [] },
        ...group(lines, 2).map((items, index) => ({
          heading: `Conversation · ${String(index + 1).padStart(2, '0')}`,
          body: items.join('\n\n'),
          sourcePoints: items.map((_, offset) => index * 2 + offset + 1),
        })),
        { heading: 'Review prompt', body: 'Host 2: Which idea would you explain first, and what detail from the source supports it?', sourcePoints: [] },
      ],
    };
  }

  return {
    summary,
    sections: group(points, 2).map((items, index) => {
      const start = index * 2;
      return {
        heading: `Scene ${String(index + 1).padStart(2, '0')}`,
        body: items.map((point, offset) => `On screen: ${compactHeading(point, start + offset).replace(/…$/, '')}\nVoice-over: ${point}`).join('\n\n'),
        sourcePoints: items.map((_, offset) => start + offset + 1),
      };
    }),
  };
}

export function artifactText(kind: StudyArtifactKind, title: string, content: StudyArtifactContent) {
  return [title, artifactKinds.find((item) => item.kind === kind)?.title ?? 'Study artifact', content.summary,
    ...content.sections.map((section, index) => `${index + 1}. ${section.heading}\n${section.body}${section.sourcePoints.length ? `\nSources: ${section.sourcePoints.map((point) => `Note ${point}`).join(', ')}` : ''}`),
  ].join('\n\n');
}
