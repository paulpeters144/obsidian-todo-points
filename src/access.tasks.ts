import { VaultFileSnapshot } from "./access.vault";

export const DAY_MS = 24 * 60 * 60 * 1000;

const TASK_RE = /^(\s*[-*]\s+)\[( |x|X)\]\s+(.*)$/;
const POINTS_RE = /#p(\d+)\b/i;
const ALL_TAGS_RE = /#([\w][\w/-]*)/g;

const MONTHS: Record<string, number> = {
	jan: 1, january: 1,
	feb: 2, february: 2,
	mar: 3, march: 3,
	apr: 4, april: 4,
	may: 5,
	jun: 6, june: 6,
	jul: 7, july: 7,
	aug: 8, august: 8,
	sep: 9, september: 9,
	oct: 10, october: 10,
	nov: 11, november: 11,
	dec: 12, december: 12,
};

export interface TaskItem {
	filePath: string;
	line: number;
	points: number;
	projects: string[];
	done: boolean;
	completedAt: number | null;
}

export function startOfDay(t: number): number {
	const d = new Date(t);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

export function startOfWeek(t: number): number {
	const d = new Date(t);
	d.setHours(0, 0, 0, 0);
	const offset = (d.getDay() + 6) % 7;
	return d.getTime() - offset * DAY_MS;
}

export function startOfMonth(t: number): number {
	const d = new Date(t);
	return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function toTimestamp(year: number, month: number, day: number): number | null {
	if (month < 1 || month > 12) return null;
	if (day < 1 || day > 31) return null;
	return new Date(year, month - 1, day, 12).getTime();
}

function parseDate(text: string): number | null {
	const iso = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
	if (iso) {
		return toTimestamp(Number(iso[1]), Number(iso[2]), Number(iso[3]));
	}

	const named = text.match(
		/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i
	);
	if (named) {
		const m = MONTHS[named[1].toLowerCase()];
		if (m) return toTimestamp(Number(named[3]), m, Number(named[2]));
	}

	const named2 = text.match(
		/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/i
	);
	if (named2) {
		const m = MONTHS[named2[2].toLowerCase()];
		if (m) return toTimestamp(Number(named2[3]), m, Number(named2[1]));
	}

	const numeric = text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
	if (numeric) {
		const a = Number(numeric[1]);
		const b = Number(numeric[2]);
		if (a > 12) return toTimestamp(Number(numeric[3]), b, a);
		return toTimestamp(Number(numeric[3]), a, b);
	}

	return null;
}

export function hasTasks(content: string): boolean {
	return content.split("\n").some((line) => TASK_RE.test(line));
}

export function parseTasks(files: VaultFileSnapshot[]): TaskItem[] {
	const tasks: TaskItem[] = [];
	for (const file of files) {
		const lines = file.content.split("\n");
		let currentDate: number | null = null;
		lines.forEach((raw, i) => {
			const m = raw.match(TASK_RE);
			if (!m) {
				const d = parseDate(raw);
				if (d !== null) currentDate = d;
				return;
			}
			const body = m[3];
			const done = m[2].toLowerCase() === "x";
			const pm = body.match(POINTS_RE);
			const points = pm ? parseInt(pm[1], 10) : 0;
			const projects: string[] = [];
			for (const tag of body.match(ALL_TAGS_RE) ?? []) {
				const name = tag.slice(1).toLowerCase();
				if (/^p\d+$/i.test(name)) continue;
				if (!projects.includes(name)) projects.push(name);
			}
			tasks.push({
				filePath: file.path,
				line: i,
				points,
				projects,
				done,
				completedAt: done ? currentDate ?? file.mtime : null,
			});
		});
	}
	return tasks;
}

export function sumPointsBetween(
	tasks: TaskItem[],
	from: number,
	to: number
): number {
	return tasks
		.filter(
			(t) =>
				t.done &&
				t.completedAt !== null &&
				t.completedAt >= from &&
				t.completedAt < to
		)
		.reduce((sum, t) => sum + t.points, 0);
}
