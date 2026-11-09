export type CollectionResult = {
  exportedAt: string;
  courseId: string;
  problems: Array<Record<string, unknown>>;
  issues: string[];
};

export function collectCourseInPage(courseId: string, chapterFilter: string): Promise<CollectionResult> {
  const baseUrl = "https://mentorpick.com";
  const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  const normalize = (value: string) => value.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const sectionText = (heading: Element | null): string => {
    if (!heading) return "";
    const parts: string[] = [];
    for (let node = heading.nextElementSibling; node; node = node.nextElementSibling) {
      if (node.matches("h4, h5, h6")) break;
      if (node.matches("li")) parts.push(`- ${node.textContent ?? ""}`);
      else parts.push(node.textContent ?? "");
    }
    return normalize(parts.join("\n"));
  };
  const parseProblemHtml = (html: string) => {
    const document = new DOMParser().parseFromString(html.replace(/<style[\s\S]*?<\/style>/gi, ""), "text/html");
    const findSection = (name: string) => [...document.querySelectorAll("h4")].find((heading) => (heading.textContent ?? "").trim().toLowerCase() === name.toLowerCase()) ?? null;
    const examples = [...document.querySelectorAll('pre[id^="input-"]')].map((input) => {
      const number = input.id.slice("input-".length);
      const output = document.querySelector(`#output-${CSS.escape(number)}`);
      const explanation = document.querySelector(`#explanation-${CSS.escape(number)}`);
      return {
        input: normalize(input.textContent ?? ""),
        output: normalize(output?.textContent ?? ""),
        ...(explanation ? { explanation: normalize(explanation.textContent ?? "") } : {})
      };
    }).filter((example) => example.input || example.output);
    return {
      difficulty: normalize(document.querySelector("#difficultyTag")?.textContent ?? ""),
      description: sectionText(findSection("Description")),
      input_format: sectionText(findSection("Input Format")),
      output_format: sectionText(findSection("Output Format")),
      constraints: sectionText(findSection("Constraints")),
      examples
    };
  };
  const getJson = async (path: string) => {
    const response = await fetch(`${baseUrl}${path}`, { credentials: "include" });
    if (!response.ok) throw new Error(`GET ${path} returned HTTP ${response.status}`);
    return response.json();
  };
  const getText = async (path: string) => {
    const response = await fetch(`${baseUrl}${path}`, { credentials: "include" });
    if (!response.ok) throw new Error(`GET ${path} returned HTTP ${response.status}`);
    return response.text();
  };
  const getWithRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < 2) await wait(500 * (attempt + 1));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Request failed.");
  };

  return (async () => {
    const courseResponse = await getWithRetry(() => getJson(`/api/courseV2/${encodeURIComponent(courseId)}`));
    const course = courseResponse?.data;
    if (!course) throw new Error("Course response did not contain data.");
    const contestId = course.defaultContestId;
    const contestSlug = course.defaultContestSlug;
    const courseItems = Array.isArray(course.courseItems) ? course.courseItems : [];
    const problems: Array<Record<string, unknown>> = [];
    const issues: string[] = [];
    let problemNumber = 0;

    for (const chapter of courseItems) {
      if (chapterFilter && chapter.title !== chapterFilter) continue;
      try {
        const chapterResponse = await getWithRetry(() => getJson(`/api/courseV2/${encodeURIComponent(courseId)}/chapter/${encodeURIComponent(chapter._id)}`));
        const sections = Array.isArray(chapterResponse?.data?.items) ? chapterResponse.data.items : [];
        for (const section of sections) {
          if (section.sectionType !== "coding-problem") continue;
          const questions = Array.isArray(section.questions) ? section.questions : [];
          for (const question of questions) {
            problemNumber += 1;
            try {
              const query = `contestId=${encodeURIComponent(contestId)}&courseId=${encodeURIComponent(courseId)}&sectionId=${encodeURIComponent(section.id)}&chapterId=${encodeURIComponent(chapter._id)}`;
              const htmlPath = `/api/courseV2/problem/html/${encodeURIComponent(question.slug)}?contestId=${encodeURIComponent(contestId)}&courseId=${encodeURIComponent(courseId)}`;
              const [html, submissionsResponse] = await Promise.all([
                getWithRetry(() => getText(htmlPath)),
                getWithRetry(() => getJson(`/api/courseV2/contest/problem/submission/my?problemSlug=${encodeURIComponent(question.slug)}&contestSlug=${encodeURIComponent(contestSlug)}&limit=200&page=1&courseId=${encodeURIComponent(courseId)}&contestId=${encodeURIComponent(contestId)}`))
              ]);
              const parsed = parseProblemHtml(html);
              const submissions = Array.isArray(submissionsResponse?.data) ? submissionsResponse.data : [];
              const accepted = submissions.filter((submission: Record<string, unknown>) => submission.verdictString === "ACCEPTED");
              const acceptedPython = accepted.filter((submission: Record<string, unknown>) => submission.language === "PYTHON");
              const candidates = (acceptedPython.length ? acceptedPython : accepted).sort((left: Record<string, unknown>, right: Record<string, unknown>) => {
                const leftDate = Date.parse(String(left.created_at ?? ""));
                const rightDate = Date.parse(String(right.created_at ?? ""));
                return rightDate - leftDate;
              });
              const selected = candidates[0];
              let studentCode: string | null = null;
              let studentLanguage: string | null = null;
              let studentSubmissionId: string | null = null;
              let studentStatus = "no submissions";
              if (selected) {
                const detail = await getWithRetry(() => getJson(`/api/submission/${encodeURIComponent(String(selected.id))}`));
                studentCode = detail?.submission?.code ?? null;
                studentLanguage = detail?.submission?.language ?? selected.language ?? null;
                studentSubmissionId = String(selected.id);
                studentStatus = "ACCEPTED";
              } else if (submissions.length) {
                studentStatus = `attempted, none accepted (${String(submissions[0].verdictString ?? "unknown")})`;
              }
              problems.push({
                n: problemNumber,
                chapter: chapter.title,
                section: section.title,
                id: question.id,
                slug: question.slug,
                title: question.title,
                ...parsed,
                student_code: studentCode,
                student_language: studentLanguage,
                student_submission_id: studentSubmissionId,
                student_status: studentStatus
              });
              await wait(350);
            } catch (error) {
              const message = `Problem ${problemNumber} (${String(question.title ?? question.slug)}): ${error instanceof Error ? error.message : "unknown error"}`;
              issues.push(message);
            }
          }
        }
      } catch (error) {
        issues.push(`Chapter ${String(chapter.title ?? chapter._id)}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }

    return { exportedAt: new Date().toISOString(), courseId, problems, issues };
  })();
}
