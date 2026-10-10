import {
	DEFAULT_SETTINGS,
	SettingsAccess,
	TodoPointsSettings,
} from "./access.settings";
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
}

export interface Stats {
	today: number;
	week: number;
	month: number;
}

export type AppRequest =
	| { type: "init" }
	| { type: "getChart"; period: Period }
	| { type: "setFolder"; folder: string };

export type AppResponse =
	| { type: "ready"; folder: string }
	| { type: "chart"; stats: Stats; chart: ChartData }
	| { type: "folderSaved"; folder: string };

export type AppEvent = { type: "dataChanged" };

export class AppManager {
	private settingsAccess: SettingsAccess;
	private vaultAccess: VaultAccess;
	private settings: TodoPointsSettings = DEFAULT_SETTINGS;
	private tasks: TaskItem[] = [];
	private listeners: ((event: AppEvent) => void)[] = [];

	constructor(deps: {
		settingsAccess: SettingsAccess;
		vaultAccess: VaultAccess;
	}) {
		this.settingsAccess = deps.settingsAccess;
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
				this.settings = await this.settingsAccess.load();
				await this.rescan();
				return { type: "ready", folder: this.settings.listFolder };
			}
			case "getChart":
				return {
					type: "chart",
					stats: this.computeStats(),
					chart: this.chartData(request.period),
				};
			case "setFolder": {
				this.settings = {
					...this.settings,
					listFolder: request.folder,
				};
				await this.settingsAccess.save(this.settings);
				await this.rescan();
				return { type: "folderSaved", folder: this.settings.listFolder };
			}
		}
	}

	private async rescan(): Promise<void> {
		const files = await this.vaultAccess.readMarkdownFolder(
			this.settings.listFolder
		);
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

	private chartData(period: Period): ChartData {
		const now = Date.now();
		const ranges: {
			label: string;
			start: number;
			end: number;
			isCurrent: boolean;
		}[] = [];
		if (period === "day") {
			const today = startOfDay(now);
			for (let i = 6; i >= 0; i--) {
				const start = today - i * DAY_MS;
				ranges.push({
					label: new Date(start).toLocaleDateString(undefined, {
						weekday: "short",
					}),
					start,
					end: start + DAY_MS,
					isCurrent: i === 0,
				});
			}
		} else if (period === "week") {
			const thisWeek = startOfWeek(now);
			for (let i = 7; i >= 0; i--) {
				const start = thisWeek - i * 7 * DAY_MS;
				ranges.push({
					label: new Date(start).toLocaleDateString(undefined, {
						month: "short",
						day: "numeric",
					}),
					start,
					end: start + 7 * DAY_MS,
					isCurrent: i === 0,
				});
			}
		} else {
			const d = new Date(startOfMonth(now));
			for (let i = 5; i >= 0; i--) {
				const start = new Date(
					d.getFullYear(),
					d.getMonth() - i,
					1
				).getTime();
				const end = new Date(
					d.getFullYear(),
					d.getMonth() - i + 1,
					1
				).getTime();
				ranges.push({
					label: new Date(start).toLocaleDateString(undefined, {
						month: "short",
					}),
					start,
					end,
					isCurrent: i === 0,
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

		return { buckets, projects };
	}
}
