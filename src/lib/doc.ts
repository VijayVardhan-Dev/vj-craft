import type { Entry, Profile } from "../types";

function escHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function wordField(code: string, cached: string): string {
  return `<!--[if supportFields]><span style='mso-element:field-begin'></span> ${code} <span style='mso-element:field-separator'></span><![endif]-->${cached}<!--[if supportFields]><span style='mso-element:field-end'></span><![endif]-->`;
}

export function buildDoc(profile: Profile, entries: Entry[]): string {
  const title = `${profile.subject}_AY_${profile.year} MentorPick Problems`;
  const footer = `Roll No:${profile.roll} &nbsp; (${profile.cls})_${profile.subject}(${profile.reg})(MentorPick Problems)_AY_${profile.year}`;
  const topics = [...new Set(entries.map((entry) => entry.topic))].map((name) => ({
    name,
    items: entries.filter((entry) => entry.topic === name)
  }));
  const indexRows = topics.map((topic, index) => `
    <tr><td align="center">${index + 1}</td><td>${escHtml(topic.name)}</td>
    <td align="center">${topic.items.length}</td><td align="center">${wordField(`PAGEREF topic_${index} \\h`, String(index + 1))}</td></tr>`).join("");
  const body = topics.map((topic, topicIndex) => `
    <h1 class="topic"><a name="topic_${topicIndex}"></a>${escHtml(topic.name)} (${topic.items.length} ${topic.items.length === 1 ? "program" : "programs"})</h1>
    ${topic.items.map((entry, index) => `
      <div class="entry">
        <p class="lbl">${index + 1}. Aim:</p><p class="q">${escHtml(entry.question)}</p>
        <p class="lbl">Source Code:</p><table class="code" width="100%" cellspacing="0" cellpadding="8" border="1"><tr><td><pre>${escHtml(entry.code)}</pre></td></tr></table>
        <p class="lbl">Output:</p><table class="out" width="100%" cellspacing="0" cellpadding="8" border="1"><tr><td><pre>${escHtml(entry.output) || "(no output captured)"}</pre></td></tr></table>
      </div>`).join("")}`).join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escHtml(title)}</title>
  <style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2933}p.ctitle{font-size:22pt;font-weight:bold;color:#1e3a8a;text-align:center;margin-top:40pt}p.college{text-align:center;font-size:14pt;color:#374151}h1.topic{font-size:17pt;color:#1e3a8a;border-bottom:2px solid #2563eb;padding-bottom:3pt;margin-top:18pt}p.lbl{font-weight:bold;font-size:12pt;color:#111827;margin:12pt 0 3pt}p.q{margin:0 0 4pt}table{border-collapse:collapse;border-color:#cbd2d9}table.code{background:#f3f4f6;border-left:4px solid #2563eb}table.out{background:#ecfdf3;border-left:4px solid #16a34a}pre{font-family:Consolas,'Courier New',monospace;font-size:10pt;margin:0}</style></head>
  <body><div class="Section1"><p class="ctitle">${escHtml(title)}</p><p class="college">${escHtml(profile.college)}</p><br><br>
  <table cellspacing="0" cellpadding="6"><tr><td><b>Name:</b></td><td>${escHtml(profile.name)}</td></tr><tr><td><b>Roll No.:</b></td><td>${escHtml(profile.roll)}</td></tr><tr><td><b>Class &amp; Sec:</b></td><td>${escHtml(profile.cls)}</td></tr><tr><td><b>Academic Year:</b></td><td>${escHtml(profile.year)}</td></tr></table><br><br>
  <table width="100%" cellspacing="0" cellpadding="6" border="1"><tr><th bgcolor="#1e3a8a"><font color="#fff">S.No.</font></th><th bgcolor="#1e3a8a"><font color="#fff">Experiment / Topic Name</font></th><th bgcolor="#1e3a8a"><font color="#fff">Total Programs</font></th><th bgcolor="#1e3a8a"><font color="#fff">Page No.</font></th></tr>${indexRows}</table></div>
  <br clear="all" style="page-break-before:always"><div>${body}</div><div style="mso-element:footer"><p align="center">${footer}<br>${wordField("PAGE", "1")}</p></div></body></html>`;
}
