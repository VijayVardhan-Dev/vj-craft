import {
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun
} from "docx";
import type { Profile } from "../types";

export type CollectedExample = { input?: string; output?: string; explanation?: string };
export type CollectedProblem = {
  chapter?: string;
  section?: string;
  title?: string;
  description?: string;
  input_format?: string;
  output_format?: string;
  constraints?: string;
  examples?: CollectedExample[];
  student_code?: string | null;
  student_language?: string | null;
  student_status?: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function multilineParagraph(value: string, style?: string): Paragraph {
  const lines = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const runs: TextRun[] = [];
  lines.forEach((line, index) => {
    if (index) runs.push(new TextRun({ break: 1 }));
    runs.push(new TextRun({ text: line }));
  });
  return new Paragraph({ style, children: runs });
}

function labelled(label: string, value: string): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun({ text: label, bold: true })] }),
    new Paragraph(""),
    multilineParagraph(value || "(not available)")
  ];
}

export async function buildDocx(profile: Profile, problems: CollectedProblem[]): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({ text: `${profile.subject} AY ${profile.year} MentorPick Problems`, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: profile.college }),
    new Paragraph({ text: `Name: ${profile.name}` }),
    new Paragraph({ text: `Roll No.: ${profile.roll}` }),
    new Paragraph({ text: `Class & Section: ${profile.cls}` }),
    new Paragraph({ text: `Academic Year: ${profile.year}` }),
    new Paragraph({ children: [new PageBreak()] })
  ];

  const topics = [...new Set(problems.map((problem) => text(problem.chapter) || "General"))];
  let globalNumber = 0;
  topics.forEach((topic) => {
    const topicProblems = problems.filter((problem) => (text(problem.chapter) || "General") === topic);
    children.push(new Paragraph({ text: `${topic} (${topicProblems.length} of ${topicProblems.length})`, heading: HeadingLevel.HEADING_1 }));
    topicProblems.forEach((problem, topicIndex) => {
    globalNumber += 1;
    const aim = text(problem.description) || "(not available)";
    const code = problem.student_code || "MISSING: no accepted submission was found.";
    const output = (problem.examples ?? []).map((example, exampleIndex) => [
      `Example ${exampleIndex + 1}`,
      `Input:\n${text(example.input) || "(empty)"}`,
      `Output:\n${text(example.output) || "(empty)"}`,
      example.explanation ? `Explanation:\n${example.explanation}` : ""
    ].filter(Boolean).join("\n")).join("\n\n") || "(no sample output captured)";

    children.push(
      new Paragraph({ text: `${topicIndex + 1}.`, heading: HeadingLevel.HEADING_2 }),
      ...labelled("Aim", aim),
      new Paragraph({ children: [new TextRun({ text: "Source Code", bold: true })] }),
      new Paragraph(""),
      multilineParagraph(code, "Code"),
      new Paragraph({ children: [new TextRun({ text: "Output", bold: true })] }),
      new Paragraph(""),
      multilineParagraph(output, "Code"),
      ...(globalNumber < problems.length ? [new Paragraph({ children: [new PageBreak()] })] : [])
    );
    });
  });

  const document = new Document({
    styles: {
      paragraphStyles: [{
        id: "Code",
        name: "Code",
        basedOn: "Normal",
        run: { font: "Consolas", size: 20 },
        paragraph: { spacing: { after: 120 } }
      }]
    },
    sections: [{ properties: {}, children }]
  });
  return Packer.toBlob(document);
}
