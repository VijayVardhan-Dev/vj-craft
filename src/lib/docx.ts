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

function labelled(label: string, value: string): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun({ text: label, bold: true })] }),
    new Paragraph(value || "(not available)")
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

  problems.forEach((problem, index) => {
    const aim = [problem.description, problem.input_format && `Input Format:\n${problem.input_format}`, problem.output_format && `Output Format:\n${problem.output_format}`, problem.constraints && `Constraints:\n${problem.constraints}`].filter(Boolean).join("\n\n");
    const code = problem.student_code || "MISSING: no accepted submission was found.";
    const output = (problem.examples ?? []).map((example, exampleIndex) => [
      `Example ${exampleIndex + 1}`,
      `Input:\n${text(example.input) || "(empty)"}`,
      `Output:\n${text(example.output) || "(empty)"}`,
      example.explanation ? `Explanation:\n${example.explanation}` : ""
    ].filter(Boolean).join("\n")).join("\n\n") || "(no sample output captured)";

    children.push(
      new Paragraph({ text: `${index + 1}. ${text(problem.title) || "Untitled problem"}`, heading: HeadingLevel.HEADING_1 }),
      ...labelled("Aim", aim),
      new Paragraph({ children: [new TextRun({ text: "Source Code", bold: true })] }),
      new Paragraph({ style: "Code", text: code }),
      new Paragraph({ children: [new TextRun({ text: `Code source: ${problem.student_status || "unknown"}${problem.student_language ? ` (${problem.student_language})` : ""}`, italics: true })] }),
      new Paragraph({ children: [new TextRun({ text: "Output", bold: true })] }),
      new Paragraph({ style: "Code", text: output }),
      ...(index < problems.length - 1 ? [new Paragraph({ children: [new PageBreak()] })] : [])
    );
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
