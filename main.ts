import {
	ItemView,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	App,
} from "obsidian";
import {
	Decoration,
	DecorationSet,
	EditorView,
	MatchDecorator,
	ViewPlugin,
	ViewUpdate,
} from "@codemirror/view";

const VIEW_TYPE_TODO_POINTS = "todo-points-view";

const DAY_MS = 24 * 60 * 60 * 1000;

const TASK_RE = /^(\s*[-*]\s+)\[( |x|X)\]\s+(.*)$/;
const POINTS_RE = /#p(\d+)\b/i;
const TAG_RE = /#p\d+\b/gi;

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

interface TaskItem {
	filePath: string;
	line: number;
	points: number;
	done: boolean;
	completedAt: number | null;
}

interface TodoPointsSettings {
	listFolder: string;
}

const DEFAULT_SETTINGS: TodoPointsSettings = {
	listFolder: "example-lists",
};

type Period = "day" | "week" | "month";

function startOfDay(t: number): number {
	const d = new Date(t);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function startOfWeek(t: number): number {
	const d = new Date(t);
	d.setHours(0, 0, 0, 0);
	const offset = (d.getDay() + 6) % 7;
	return d.getTime() - offset * DAY_MS;
}

function startOfMonth(t: number): number {
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

interface Bucket {
	label: string;
	total: number;
	isCurrent: boolean;
}

const tagDecorator = new MatchDecorator({
	regexp: TAG_RE,
	decoration: Decoration.mark({ class: "todo-points-tag" }),
});

class TagHighlighter {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = tagDecorator.createDeco(view);
	}

	update(update: ViewUpdate) {
		this.decorations = tagDecorator.updateDeco(update, this.decorations);
	}
}

const tagHighlighter = ViewPlugin.fromClass(TagHighlighter, {
	decorations: (v) => v.decorations,
});

export default class TodoPointsPlugin extends Plugin {
	settings: TodoPointsSettings;
	tasks: TaskItem[] = [];

	async onload() {
		await this.loadSettings();
		await this.scanTasks();

		this.registerView(
			VIEW_TYPE_TODO_POINTS,
			(leaf) => new TodoPointsView(leaf, this)
		);

		this.addRibbonIcon("list-todo", "Todo points", () => {
			this.activateView();
		});

		this.addCommand({
			id: "open-todo-points",
			name: "Open todo points",
			callback: () => this.activateView(),
		});

		this.addSettingTab(new TodoPointsSettingTab(this.app, this));

		this.registerEditorExtension(tagHighlighter);

		this.registerMarkdownPostProcessor((el) => {
			el.querySelectorAll("a.tag").forEach((tag) => {
				if (/^#p\d+$/i.test(tag.getText())) {
					tag.addClass("todo-points-tag");
				}
			});
		});

		const onChange = () => {
			this.scanTasks().then(() => this.refreshViews());
		};
		this.registerEvent(this.app.vault.on("modify", onChange));
		this.registerEvent(this.app.vault.on("create", onChange));
		this.registerEvent(this.app.vault.on("delete", onChange));
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_TODO_POINTS)[0];
		if (!leaf) {
			const rightLeaf = workspace.getRightLeaf(false);
			if (!rightLeaf) return;
			await rightLeaf.setViewState({
				type: VIEW_TYPE_TODO_POINTS,
				active: true,
			});
			leaf = rightLeaf;
		}
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		const loaded = (await this.loadData()) as Partial<TodoPointsSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	inFolder(path: string): boolean {
		const folder = this.settings.listFolder.replace(/^\/+|\/+$/g, "");
		if (folder === "") return true;
		return path === folder || path.startsWith(folder + "/");
	}

	async scanTasks() {
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((f) => this.inFolder(f.path));
		const tasks: TaskItem[] = [];
		for (const file of files) {
			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");
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
				tasks.push({
					filePath: file.path,
					line: i,
					points,
					done,
					completedAt: done ? currentDate ?? file.stat.mtime : null,
				});
			});
		}
		this.tasks = tasks;
	}

	doneTasks(): TaskItem[] {
		return this.tasks.filter((t) => t.done);
	}

	pointsBetween(from: number, to: number): number {
		return this.doneTasks()
			.filter(
				(t) =>
					t.completedAt !== null &&
					t.completedAt >= from &&
					t.completedAt < to
			)
			.reduce((sum, t) => sum + t.points, 0);
	}

	buckets(period: Period): Bucket[] {
		const now = Date.now();
		const buckets: Bucket[] = [];
		if (period === "day") {
			const today = startOfDay(now);
			for (let i = 6; i >= 0; i--) {
				const start = today - i * DAY_MS;
				buckets.push({
					label: new Date(start).toLocaleDateString(undefined, {
						weekday: "short",
					}),
					total: this.pointsBetween(start, start + DAY_MS),
					isCurrent: i === 0,
				});
			}
		} else if (period === "week") {
			const thisWeek = startOfWeek(now);
			for (let i = 7; i >= 0; i--) {
				const start = thisWeek - i * 7 * DAY_MS;
				buckets.push({
					label: new Date(start).toLocaleDateString(undefined, {
						month: "short",
						day: "numeric",
					}),
					total: this.pointsBetween(start, start + 7 * DAY_MS),
					isCurrent: i === 0,
				});
			}
		} else {
			const thisMonth = startOfMonth(now);
			const d = new Date(thisMonth);
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
				buckets.push({
					label: new Date(start).toLocaleDateString(undefined, {
						month: "short",
					}),
					total: this.pointsBetween(start, end),
					isCurrent: i === 0,
				});
			}
		}
		return buckets;
	}

	refreshViews() {
		for (const leaf of this.app.workspace.getLeavesOfType(
			VIEW_TYPE_TODO_POINTS
		)) {
			const view = leaf.view;
			if (view instanceof TodoPointsView) view.render();
		}
	}
}

class TodoPointsView extends ItemView {
	plugin: TodoPointsPlugin;
	private period: Period = "day";
	private canvas: HTMLCanvasElement | null = null;
	private resizeObserver: ResizeObserver | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TodoPointsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TODO_POINTS;
	}

	getDisplayText(): string {
		return "Todo points";
	}

	getIcon(): string {
		return "list-todo";
	}

	async onOpen() {
		this.resizeObserver = new ResizeObserver(() => this.drawChart());
		this.resizeObserver.observe(this.contentEl);
		await this.plugin.scanTasks();
		this.render();
	}

	async onClose() {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	render() {
		const container = this.contentEl;
		container.empty();
		container.addClass("todo-points-container");

		const header = container.createDiv({ cls: "todo-points-header" });
		header.createEl("h4", { text: "Todo points" });

		const body = container.createDiv({ cls: "todo-points-body" });
		this.renderStats(body);
	}

	private renderStats(parent: HTMLElement) {
		const now = Date.now();
		const cards = parent.createDiv({ cls: "todo-points-cards" });
		this.renderCard(cards, "Today", this.plugin.pointsBetween(startOfDay(now), now + 1));
		this.renderCard(cards, "This week", this.plugin.pointsBetween(startOfWeek(now), now + 1));
		this.renderCard(cards, "This month", this.plugin.pointsBetween(startOfMonth(now), now + 1));

		const periods = parent.createDiv({ cls: "todo-points-periods" });
		const options: { period: Period; label: string }[] = [
			{ period: "day", label: "7 days" },
			{ period: "week", label: "8 weeks" },
			{ period: "month", label: "6 months" },
		];
		for (const opt of options) {
			const btn = periods.createEl("button", {
				cls:
					"todo-points-period" +
					(this.period === opt.period ? " is-active" : ""),
				text: opt.label,
			});
			btn.addEventListener("click", () => {
				this.period = opt.period;
				this.render();
			});
		}

		const chartWrap = parent.createDiv({ cls: "todo-points-chart" });
		this.canvas = chartWrap.createEl("canvas");
		window.requestAnimationFrame(() => this.drawChart());
	}

	private renderCard(parent: HTMLElement, label: string, value: number) {
		const card = parent.createDiv({ cls: "todo-points-card" });
		card.createDiv({ cls: "todo-points-card-value", text: String(value) });
		card.createDiv({ cls: "todo-points-card-label", text: label });
	}

	private drawChart() {
		const canvas = this.canvas;
		if (!canvas || !canvas.isConnected) return;
		const parent = canvas.parentElement;
		if (!parent) return;
		const width = parent.clientWidth;
		const height = 180;
		if (width <= 0) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, width, height);

		const css = getComputedStyle(canvas);
		const accent =
			css.getPropertyValue("--interactive-accent").trim() || "#7c3aed";
		const muted =
			css.getPropertyValue("--text-muted").trim() || "#999999";
		const faint = css.getPropertyValue("--text-faint").trim() || "#666666";
		const fontFamily = css.getPropertyValue("--font-interface").trim();

		const data = this.plugin.buckets(this.period);
		const max = Math.max(...data.map((b) => b.total), 1);

		const padLeft = 6;
		const padRight = 6;
		const padTop = 18;
		const padBottom = 22;
		const chartWidth = width - padLeft - padRight;
		const chartHeight = height - padTop - padBottom;
		const baseY = padTop + chartHeight;

		ctx.strokeStyle = faint;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(padLeft, baseY + 0.5);
		ctx.lineTo(width - padRight, baseY + 0.5);
		ctx.stroke();

		const slot = chartWidth / data.length;
		const barWidth = Math.min(34, slot * 0.6);

		ctx.font = `10px ${fontFamily || "sans-serif"}`;
		ctx.textAlign = "center";

		data.forEach((b, i) => {
			const cx = padLeft + slot * i + slot / 2;
			const barHeight = Math.max(
				b.total > 0 ? 3 : 0,
				(b.total / max) * chartHeight
			);
			const y = baseY - barHeight;

			if (barHeight > 0) {
				ctx.fillStyle = accent;
				ctx.globalAlpha = b.isCurrent ? 1 : 0.55;
				this.roundRect(ctx, cx - barWidth / 2, y, barWidth, barHeight, 3);
				ctx.fill();
				ctx.globalAlpha = 1;
			}

			ctx.fillStyle = muted;
			ctx.fillText(String(b.total), cx, y - 5);
			ctx.fillStyle = b.isCurrent ? accent : faint;
			ctx.fillText(b.label, cx, baseY + 14);
		});
	}

	private roundRect(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number
	) {
		const radius = Math.min(r, h / 2, w / 2);
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + w - radius, y);
		ctx.arcTo(x + w, y, x + w, y + radius, radius);
		ctx.lineTo(x + w, y + h);
		ctx.lineTo(x, y + h);
		ctx.lineTo(x, y + radius);
		ctx.arcTo(x, y, x + radius, y, radius);
		ctx.closePath();
	}
}

class TodoPointsSettingTab extends PluginSettingTab {
	plugin: TodoPointsPlugin;

	constructor(app: App, plugin: TodoPointsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Lists folder")
			.setDesc(
				"Folder of markdown lists to read todos from. Tasks are checkbox lines; points come from a #pN tag anywhere in the line (e.g. #p5 = 5 points). A date (year, month, and day) on a line above a list sets the completion day for its tasks."
			)
			.addText((text) =>
				text
					.setPlaceholder("example-lists")
					.setValue(this.plugin.settings.listFolder)
					.onChange(async (value) => {
						this.plugin.settings.listFolder = value.trim();
						await this.plugin.saveSettings();
						await this.plugin.scanTasks();
						this.plugin.refreshViews();
					})
			);
	}
}
