import { VaultAccess } from "./access.vault";
import {
	DAY_MS,
	parseTasks,
	startOfDay,
	startOfMonth,
	startOfWeek,
	sumPointsBetween,
	TaskItem,
} from "./access.tasks";

export type Period = "day" | "week" | "month";

export interface BucketSegment {
	project: string;
	value: number;
}

export interface Bucket {
	label: string;
	total: number;
	isCurrent: boolean;
	segments: BucketSegment[];
}

export interface ChartData {
	buckets: Bucket[];
	projects: { name: string; total: number }[];
	rangeLabel: string;
}

export interface Stats {
	today: number;
	week: number;
	month: number;
}

export type AppRequest =
	| { type: "init" }
	| { type: "getChart"; period: Period; offset: number };

export type AppResponse =
	| { type: "ready" }
	| { type: "chart"; stats: Stats; chart: ChartData };

export type AppEvent = { type: "dataChanged" };

export class AppManager {
	private vaultAccess: VaultAccess;
	private tasks: TaskItem[] = [];
	private listeners: ((event: AppEvent) => void)[] = [];

	constructor(deps: { vaultAccess: VaultAccess }) {
		this.vaultAccess = deps.vaultAccess;
		this.vaultAccess.onChange(() => {
			void this.rescan();
		});
	}

	onEvent(listener: (event: AppEvent) => void): void {
		this.listeners.push(listener);
	}

	private emit(event: AppEvent): void {
		for (const listener of this.listeners) listener(event);
	}

	async dispatch(request: AppRequest): Promise<AppResponse> {
		switch (request.type) {
			case "init": {
				await this.rescan();
				return { type: "ready" };
			}
			case "getChart":
				return {
					type: "chart",
					stats: this.computeStats(),
					chart: this.chartData(request.period, request.offset),
				};
		}
	}

	private async rescan(): Promise<void> {
		const files = await this.vaultAccess.readMarkdownFiles();
		this.tasks = parseTasks(files);
		this.emit({ type: "dataChanged" });
	}

	private doneTasks(): TaskItem[] {
		return this.tasks.filter((t) => t.done);
	}

	private computeStats(): Stats {
		const now = Date.now();
		return {
			today: sumPointsBetween(this.tasks, startOfDay(now), now + 1),
			week: sumPointsBetween(this.tasks, startOfWeek(now), now + 1),
			month: sumPointsBetween(this.tasks, startOfMonth(now), now + 1),
		};
	}

	private chartData(period: Period, offset: number): ChartData {
		const now = Date.now();
		const ranges: {
			label: string;
			start: number;
			end: number;
			isCurrent: boolean;
		}[] = [];
		if (period === "day") {
			const today = startOfDay(now) - offset * 7 * DAY_MS;
			for (let i = 6; i >= 0; i--) {
				const start = today - i * DAY_MS;
				ranges.push({
					label: new Date(start).toLocaleDateString(undefined, {
						weekday: "short",
					}),
					start,
					end: start + DAY_MS,
					isCurrent: offset === 0 && i === 0,
				});
			}
		} else if (period === "week") {
			const thisWeek = startOfWeek(now) - offset * 8 * 7 * DAY_MS;
			for (let i = 7; i >= 0; i--) {
				const start = thisWeek - i * 7 * DAY_MS;
				ranges.push({
					label: new Date(start).toLocaleDateString(undefined, {
						month: "short",
						day: "numeric",
					}),
					start,
					end: start + 7 * DAY_MS,
					isCurrent: offset === 0 && i === 0,
				});
			}
		} else {
			const d = new Date(startOfMonth(now));
			const anchor = new Date(
				d.getFullYear(),
				d.getMonth() - offset * 6,
				1
			);
			for (let i = 5; i >= 0; i--) {
				const start = new Date(
					anchor.getFullYear(),
					anchor.getMonth() - i,
					1
				).getTime();
				const end = new Date(
					anchor.getFullYear(),
					anchor.getMonth() - i + 1,
					1
				).getTime();
				ranges.push({
					label: new Date(start).toLocaleDateString(undefined, {
						month: "short",
					}),
					start,
					end,
					isCurrent: offset === 0 && i === 0,
				});
			}
		}

		const perRange = ranges.map(() => new Map<string, number>());
		const projectTotals = new Map<string, number>();
		for (const t of this.doneTasks()) {
			const at = t.completedAt;
			if (at === null) continue;
			ranges.forEach((r, i) => {
				if (at >= r.start && at < r.end) {
					const projects =
						t.projects.length > 0 ? t.projects : ["other"];
					for (const p of projects) {
						perRange[i].set(
							p,
							(perRange[i].get(p) ?? 0) + t.points
						);
						projectTotals.set(
							p,
							(projectTotals.get(p) ?? 0) + t.points
						);
					}
				}
			});
		}

		const order = [...projectTotals.keys()].sort((a, b) => {
			if (a === "other") return 1;
			if (b === "other") return -1;
			return (
				(projectTotals.get(b) ?? 0) - (projectTotals.get(a) ?? 0) ||
				a.localeCompare(b)
			);
		});

		const buckets = ranges.map((r, i) => {
			const segments = order
				.map((project) => ({
					project,
					value: perRange[i].get(project) ?? 0,
				}))
				.filter((s) => s.value > 0);
			return {
				label: r.label,
				total: segments.reduce((sum, s) => sum + s.value, 0),
				isCurrent: r.isCurrent,
				segments,
			};
		});

		const projects = order.map((name) => ({
			name,
			total: projectTotals.get(name) ?? 0,
		}));

		const rangeLabel = this.rangeLabel(period, ranges);

		return { buckets, projects, rangeLabel };
	}

	private rangeLabel(
		period: Period,
		ranges: { label: string; start: number; end: number }[]
	): string {
		const first = new Date(ranges[0].start);
		if (period === "month") {
			const last = new Date(ranges[ranges.length - 1].start);
			const fmt = (d: Date) =>
				d.toLocaleDateString(undefined, {
					month: "short",
					year: "numeric",
				});
			return `${fmt(first)} – ${fmt(last)}`;
		}
		const last = new Date(ranges[ranges.length - 1].end - DAY_MS);
		const showYear =
			first.getFullYear() !== new Date().getFullYear() ||
			last.getFullYear() !== first.getFullYear();
		const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
		if (showYear) opts.year = "numeric";
		const fmt = (d: Date) => d.toLocaleDateString(undefined, opts);
		return `${fmt(first)} – ${fmt(last)}`;
	}
}
