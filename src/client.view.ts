import { ItemView, WorkspaceLeaf } from "obsidian";
import { ChartData, Period, Stats } from "./manager.app";

export const VIEW_TYPE_TODO_POINTS = "todo-points-view";

export type ClientMessage = { type: "query"; period: Period };

export type ClientUpdate =
	| { type: "render"; stats: Stats; chart: ChartData }
	| { type: "refresh" };

export type SendClientMessage = (
	message: ClientMessage
) => Promise<ClientUpdate | null>;

function projectColor(project: string): string {
	if (project === "other") return "hsl(0, 0%, 55%)";
	let h = 0;
	for (let i = 0; i < project.length; i++) {
		h = (h * 31 + project.charCodeAt(i)) >>> 0;
	}
	return `hsl(${h % 360}, 65%, 55%)`;
}

export class TodoPointsView extends ItemView {
	private send: SendClientMessage;
	private period: Period = "day";
	private selectedProject: string | null = null;
	private stats: Stats = { today: 0, week: 0, month: 0 };
	private chart: ChartData = { buckets: [], projects: [] };
	private canvas: HTMLCanvasElement | null = null;
	private resizeObserver: ResizeObserver | null = null;

	constructor(leaf: WorkspaceLeaf, send: SendClientMessage) {
		super(leaf);
		this.send = send;
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
		await this.ask({ type: "query", period: this.period });
	}

	async onClose() {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	private async ask(message: ClientMessage) {
		const update = await this.send(message);
		if (update) this.receive(update);
	}

	receive(update: ClientUpdate) {
		if (update.type === "refresh") {
			void this.ask({ type: "query", period: this.period });
			return;
		}
		this.stats = update.stats;
		this.chart = update.chart;
		this.render();
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
		const cards = parent.createDiv({ cls: "todo-points-cards" });
		this.renderCard(cards, "Today", this.stats.today);
		this.renderCard(cards, "This week", this.stats.week);
		this.renderCard(cards, "This month", this.stats.month);

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
				void this.ask({ type: "query", period: this.period });
			});
		}

		const chartWrap = parent.createDiv({ cls: "todo-points-chart" });
		this.canvas = chartWrap.createEl("canvas");

		const projects = this.chart.projects.slice();
		if (
			this.selectedProject &&
			!projects.some((p) => p.name === this.selectedProject)
		) {
			projects.push({ name: this.selectedProject, total: 0 });
		}
		if (projects.length > 0) {
			const legend = chartWrap.createDiv({ cls: "todo-points-legend" });
			const allTotal = projects.reduce((sum, p) => sum + p.total, 0);
			const items = [
				{
					name: null as string | null,
					label: "all",
					total: allTotal,
					color: "var(--interactive-accent)",
				},
			].concat(
				projects.map((p) => ({
					name: p.name,
					label: p.name,
					total: p.total,
					color: projectColor(p.name),
				}))
			);
			for (const it of items) {
				const item = legend.createDiv({
					cls:
						"todo-points-legend-item" +
						(this.selectedProject === it.name ? " is-active" : ""),
				});
				item.createSpan({
					cls: "todo-points-legend-dot",
				}).style.backgroundColor = it.color;
				item.createSpan({ text: `${it.label} · ${it.total}` });
				item.addEventListener("click", () => {
					this.selectedProject =
						this.selectedProject === it.name ? null : it.name;
					this.render();
				});
			}
		}

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

		const data = this.chart.buckets;
		if (data.length === 0) return;
		const selected = this.selectedProject;
		const totals = data.map((b) =>
			selected
				? b.segments.find((s) => s.project === selected)?.value ?? 0
				: b.total
		);
		const max = Math.max(...totals, 1);

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
			const total = totals[i];
			const cx = padLeft + slot * i + slot / 2;
			const barHeight = Math.max(
				total > 0 ? 3 : 0,
				(total / max) * chartHeight
			);
			const y = baseY - barHeight;

			if (barHeight > 0) {
				ctx.globalAlpha = b.isCurrent ? 1 : 0.55;
				if (selected) {
					ctx.fillStyle = projectColor(selected);
					this.roundRect(
						ctx,
						cx - barWidth / 2,
						y,
						barWidth,
						barHeight,
						3
					);
					ctx.fill();
				} else {
					let yCursor = baseY;
					b.segments.forEach((seg, j) => {
						const segHeight = Math.max(
							(seg.value / total) * barHeight,
							1
						);
						yCursor -= segHeight;
						ctx.fillStyle = projectColor(seg.project);
						if (j === b.segments.length - 1) {
							this.roundRect(
								ctx,
								cx - barWidth / 2,
								yCursor,
								barWidth,
								segHeight,
								3
							);
							ctx.fill();
						} else {
							ctx.fillRect(
								cx - barWidth / 2,
								yCursor,
								barWidth,
								segHeight
							);
						}
					});
				}
				ctx.globalAlpha = 1;
			}

			ctx.fillStyle = muted;
			ctx.fillText(String(total), cx, y - 5);
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
