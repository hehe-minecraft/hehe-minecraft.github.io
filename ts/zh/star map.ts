import { parse_source } from "../all.js";
import { AnimationHandler } from "../css.js";
import { tools_database } from "../file.js";
import { Vector } from "../math.js";
import { interfaces } from "../interfaces.js";

namespace constants
{
	export const data_namespace = "Star Map";
	export const log_fade_time = 4000; // ms
	export const current_version = 1;
	export namespace defaults
	{
		export const content: Readonly<star_map_elements.Content> = {
			version: current_version,
			nodes: [],
			links: [],
			styles: {
				node: [],
				link: []
			},
			x: 0,
			y: 0,
			zoom: 1
		};
	}
	export namespace format
	{
		export const tick_interval = 50; // ms
		export const node_distance = 3;
		export const node_no_link_force_factor = 0.3;
	}
	export namespace display
	{
		export const canvas_scale = 5;
		export const thin_link_display_width = canvas_scale;
		export const small_node_display_size = canvas_scale * 3;
		export const activate_stroke = 2;
		export const font = "Arial";
		export const details_width_ratio = 0.3;
	}
	export namespace color
	{
		export const background = "#000000";
		export const activate = "#FFFFFF"
		export const debug = "#FFF5B0";
	}
	export namespace motion
	{
		export const mouse_sensitivity = 0.001;
		export const keyboard_drag_speed = 10 * display.canvas_scale;
		export const keyboard_zoom_speed = 100;
		export const min_zoom = 0.01;
	}
	export namespace key
	{
		export const right = "ArrowRight";
		export const left = "ArrowLeft";
		export const up = "ArrowUp";
		export const down = "ArrowDown";
		export const right_click = "Enter";
		export const zoom_in = "+";
		export const zoom_out = "-";
		export const choose = " ";
		export const undo = "z";
		export const redo = "y";
		export const remove = "Delete";
	}
	export enum mouse_button // for MouseEvent.button
	{
		left = 0,
		middle = 1,
		right = 2
	}
	export enum storage
	{
		Link,
		Node,
		Coordinate
	}
	export const element_context_menu: ReadonlyMap<storage, string> = new Map([
		[storage.Node, "node"],
		[storage.Link, "link"],
		[storage.Coordinate, "background"]
	])
	export const element_translate_name: ReadonlyMap<storage, string> = new Map([
		[storage.Node, "节点"],
		[storage.Link, "链接"],
		[storage.Coordinate, "背景"]
	])
	export namespace icons // SVG Path
	{
		export const node = "M30,10 A20,20 0 1 1 30,50 A20,20 0 1 1 30,10";
		export const link = "M10,30 h20 v20 l20,-20 v-20 h-20 Z";
	}
}
namespace star_map_elements
{
	export interface NodeStyle
	{
		color: string,
		name: string
	}
	export interface LinkStyle
	{
		backcolor: string,
		forecolor: string,
		name: string,
		onesided: boolean,
		width: number
	}
	export interface Node
	{
		content: string,
		size: number,
		style: NodeStyle,
		title: string,
		x: number,
		y: number
	}
	export interface Link
	{
		content: string,
		from: Node,
		style: LinkStyle,
		title: string,
		to: Node
	}
	export interface Coordinate
	{
		x: number,
		y: number
	}
	export type general_element = Node | Link | Coordinate;
	export class Interface
	{
		public content: general_element;
		public type: constants.storage;
		constructor(content: general_element, type: constants.storage)
		{
			this.content = content;
			this.type = type;
		}
	}
	export interface Content
	{
		version: number,
		nodes: Array<Node>,
		links: Array<Link>,
		styles: {
			node: Array<NodeStyle>,
			link: Array<LinkStyle>
		},
		x: number,
		y: number,
		zoom: number
	}
}
class ChooseItemElement<element_type> extends HTMLElement
{
	public readonly value: element_type;
	constructor(value: element_type, title?: string)
	{
		super();
		if (title !== undefined)
			this.textContent = title;
		this.value = value;
	}
}
class ChooseListElement<list_type> extends HTMLElement
{
	public value?: list_type;
	private elements: Array<ChooseItemElement<list_type>> = [];
	public readonly fixed_elements: ReadonlyArray<ChooseItemElement<list_type>>;
	constructor()
	{
		super()
		this.fixed_elements = Array.from(this.children as HTMLCollectionOf<ChooseItemElement<list_type>>);
	}
	public clear(): void
	{
		for (const each_element of this.elements)
		{
			if (!this.fixed_elements.includes(each_element))
			{
				each_element.remove();
			}
		}
		this.elements = Array.from(this.fixed_elements);
	}
	public choose(element: ChooseItemElement<list_type>): void
	{
		for (const each_element of this.elements)
		{
			if (each_element !== element)
			{
				each_element.removeAttribute("selected");
			}
		}
		element.setAttribute("selected", "");
		this.value = element.value;
	}
	public add(value: list_type, title?: string): ChooseItemElement<list_type>
	{
		const element = new ChooseItemElement<list_type>(value, title);
		this.elements.push(element);
		element.tabIndex = 0;
		element.addEventListener("click", () => { this.choose(element); });
		element.addEventListener("keydown", (event: KeyboardEvent) => {
			if (event.key === constants.key.choose || event.key === constants.key.right_click)
				element.click();
		});
		if (this.fixed_elements.length > 0)
			this.insertBefore(element, this.fixed_elements[0]);
		else
			this.appendChild(element);
		if (this.value === value)
			this.choose(element);
		return element;
	}
}
class StarMapHistory // Works like a stack
{
	private readonly master: StarMap;
	private history: Array<object> = [];
	private current_index: number = -1;
	constructor(application: StarMap)
	{
		this.master = application;
		this.clear();
	}
	public log(): void
	{
		if (this.master.debug)
		{
			console.log(`Current snapshots: ${this.current_index + 1}/${this.history.length}`);
		}
	}
	public snapshot(): void
	{
		if (this.history.length > this.current_index + 1)
		{
			this.history.splice(this.current_index + 1);
		}
		this.history.push(structuredClone(this.master.content));
		this.current_index = this.history.length - 1;
		this.log();
	}
	public undo(): boolean
	{
		if (!this.history)
			return false;
		this.current_index --;
		if (this.current_index < 0)
		{
			this.current_index = 0;
			return false;
		}
		this.log();
		this.master.content = structuredClone(this.history[this.current_index]) as star_map_elements.Content;
		this.master.flush();
		return true;
	}
	public redo(): boolean
	{
		if (!this.history)
			return false;
		this.current_index ++;
		if (this.current_index >= this.history.length)
		{
			this.current_index = this.history.length - 1;
			return false;
		}
		this.log();
		this.master.content = structuredClone(this.history[this.current_index]) as star_map_elements.Content;
		this.master.flush();
		return true;
	}
	public clear(): void
	{
		this.history = new Array();
		this.current_index = -1;
		this.log();
	}
}
class StarMap
{
	public readonly canvas: HTMLCanvasElement;
	private readonly list: HTMLSelectElement;
	public debug: boolean;
	public readonly history: StarMapHistory;
	public content: star_map_elements.Content;
	public file_name: string;
	public active_element?: star_map_elements.Interface;
	constructor(canvas: HTMLCanvasElement, list: HTMLSelectElement)
	{
		this.canvas = canvas;
		this.list = list;
		this.content = constants.defaults.content;
		this.file_name = "";
		this.debug = false;
		this.active_element = undefined;
		this.history = new StarMapHistory(this);
	}
	public get transform_matrix(): DOMMatrix
	{
		const result: DOMMatrix = new DOMMatrix();
		result.translateSelf(this.canvas.offsetLeft, this.canvas.offsetTop);
		result.scaleSelf(1 / constants.display.canvas_scale, 1 / constants.display.canvas_scale);
		result.translateSelf(this.content.x, this.content.y);
		result.translateSelf(this.canvas.width / 2, this.canvas.height / 2);
		result.scaleSelf(this.content.zoom, this.content.zoom);
		return result;
	}
	public transform_into_canvas(point: Readonly<interfaces.Point2D>): DOMPoint
	{
		return this.transform_matrix.inverse().transformPoint(new DOMPoint(point.x, point.y));
	}
	public move(difference: Readonly<interfaces.Point2D>): void
	{
		this.content.x += difference.x;
		this.content.y += difference.y;
		this.flush();
	}
	public zoom(delta: number): void
	{
		const original_zoom: number = this.content.zoom;
		this.content.zoom += delta * this.content.zoom * constants.motion.mouse_sensitivity;
		if (this.content.zoom < constants.motion.min_zoom)
		{
			this.content.zoom = constants.motion.min_zoom;
		}
		const zoom_ratio: number = this.content.zoom / original_zoom;
		this.content.x *= zoom_ratio;
		this.content.y *= zoom_ratio;
		this.flush();
	}
	public deactivate(): void
	{
		const details_area: HTMLElement = document.getElementById("details")!;
		details_area.classList.add("hide");
		details_area.style.width = "0";
		this.active_element = undefined;
		this.flush();
	}
	public activate(element?: undefined): void;
	public activate(element: star_map_elements.Interface): typeof element;
	public activate(element?: star_map_elements.Interface)
	{
		this.active_element = element;
		this.flush();
		const details_area: HTMLElement = document.getElementById("details")!;
		const icon_area: SVGPathElement = document.querySelector("#details_icon")!;
		const title_area: HTMLElement = document.getElementById("details_title")!;
		const content_area: HTMLElement = document.getElementById("details_content")!;
		if (element !== undefined && "content" in element.content)
		{
			switch (element.type)
			{
				case constants.storage.Node:
					icon_area.setAttribute("d", constants.icons.node);
					icon_area.setAttribute("fill", (element.content as star_map_elements.Node).style.color);
					title_area.style.color = (element.content as star_map_elements.Node).style.color;
					break;
				case constants.storage.Link:
					icon_area.setAttribute("d", constants.icons.link);
					icon_area.setAttribute("fill", (element.content as star_map_elements.Link).style.forecolor);
					title_area.style.color = (element.content as star_map_elements.Link).style.forecolor;
					break;
			}
			title_area.innerText = element.content.title;
			const parser = new parse_source.Parser();
			parser.source = element.content.content;
			parser.target = content_area;
			parser.parse();
			details_area.classList.remove("hide");
			const main: HTMLElement = this.canvas.parentElement!;
			details_area.style.height = `${main.clientHeight}px`;
			details_area.style.width = `${main.clientWidth * constants.display.details_width_ratio}px`;
		}
		else
		{
			details_area.classList.add("hide");
			details_area.style.width = "0";
		}
		return element;
	}
	public static draw_line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: string): void
	{
		context.strokeStyle = color;
		context.lineWidth = width;
		context.beginPath();
		context.moveTo(x1, y1);
		context.lineTo(x2, y2);
		context.stroke();
	}
	public flush(): void;
	public flush(hover_place: interfaces.Point2D): star_map_elements.Interface;
	public flush(hover_place?: interfaces.Point2D): star_map_elements.Interface | void
	{
		// This function is so complex that comments will help you better understand.
		// The comments are in the order of "Part" > "Step".
		// When hover_place is given, the function will return a StarMapInterface.
		// Part 1 - Apply the transformation.
		this.canvas.style.display = "none"; // Prevent the canvas being stretched.
		const main: HTMLElement = this.canvas.parentElement!;
		const details: HTMLElement = document.getElementById("details")!;
		this.canvas.width = (main.clientWidth - details.offsetWidth) * constants.display.canvas_scale;
		this.canvas.height = main.clientHeight * constants.display.canvas_scale;
		this.canvas.style.display = "initial";
		const context: CanvasRenderingContext2D = this.canvas.getContext("2d")!;
		context.resetTransform();
		context.textAlign = "center";
		context.fillStyle = constants.color.background;
		context.fillRect(0, 0, this.canvas.width, this.canvas.height);
		context.translate(this.canvas.width / 2, this.canvas.height / 2);
		context.translate(this.content.x, this.content.y);
		context.scale(this.content.zoom, this.content.zoom);
		// Part 2 - Display the origin in debug mode.
		if (this.debug)
		{
			context.fillStyle = constants.color.debug;
			context.beginPath();
			context.arc(0, 0, 30, 0, 2 * Math.PI)
			context.fill();
		}
		// Part 3 - Group the links.
		interface display_onesided_link
		{
			content: star_map_elements.Link;
			onesided: boolean;
		}
		const link_groups: Map<Set<star_map_elements.Node>, display_onesided_link[]> = new Map(); // Each link group shares the same endpoints.
		for (const each_link of this.content.links)
		{
			let link_group: display_onesided_link[] | undefined = undefined;
			let onesided = each_link.style.onesided;
			for (const each_link_endpoint_pair of link_groups.keys())
			{
				if (each_link_endpoint_pair.has(each_link.from) && each_link_endpoint_pair.has(each_link.to))
				{
					link_group = link_groups.get(each_link_endpoint_pair);
					break;
				}
			}
			if (link_group === undefined)
			{
				link_group = [];
				link_groups.set(new Set([each_link.from, each_link.to]), link_group);
			}
			else if (onesided)
			{
				for (const each_link2 of link_group)
				{
					if (each_link.style == each_link2.content.style)
					{
						onesided = false;
						link_group.splice(link_group.indexOf(each_link2), 1);
						break;
					}
				}
			}
			link_group.push({content: each_link, onesided: onesided});
		}
		// Part 4 - Display the links and detect which link is hovered.
		let hovering: star_map_elements.Interface | undefined = undefined;
		const transform_matrix = new DOMMatrix();
		transform_matrix.scaleSelf(1 / constants.display.canvas_scale, 1 / constants.display.canvas_scale);
		transform_matrix.translateSelf(this.content.x, this.content.y);
		transform_matrix.translateSelf(this.canvas.width / 2, this.canvas.height / 2);
		transform_matrix.scaleSelf(this.content.zoom, this.content.zoom);
		for (const each_link_group of link_groups.values())
		{
			// Step 1 - Optimize when the link is out of the screen, because the expense of displaying a link is so huge.
			const link_from_transformed = transform_matrix.transformPoint(new DOMPoint(each_link_group[0].content.from.x, each_link_group[0].content.from.y));
			const link_to_transformed = transform_matrix.transformPoint(new DOMPoint(each_link_group[0].content.to.x, each_link_group[0].content.to.y));
			if ((link_from_transformed.x < 0 || link_from_transformed.x > this.canvas.width / constants.display.canvas_scale
				|| link_from_transformed.y < 0 || link_from_transformed.y > this.canvas.height / constants.display.canvas_scale)
				&& (link_to_transformed.x < 0 || link_to_transformed.x > this.canvas.width / constants.display.canvas_scale
				|| link_to_transformed.y < 0 || link_to_transformed.y > this.canvas.height / constants.display.canvas_scale))
			{
				continue;
			}
			// Step 2 - Update the link offset.
			const link_length = Math.sqrt((each_link_group[0].content.from.x - each_link_group[0].content.to.x) ** 2 + (each_link_group[0].content.from.y - each_link_group[0].content.to.y) ** 2);
			let link_group_width = 0;
			for (const each_link_wrapper of each_link_group.values())
				link_group_width += each_link_wrapper.content.style.width;
			let link_offset = (-link_group_width - each_link_group[0].content.style.width) / 2;
			for (const each_link_wrapper of each_link_group.values())
			{
				const each_link: star_map_elements.general_element = each_link_wrapper.content;
				link_offset += each_link.style.width;
				// Step 3 - Detect the hovered link.
				// We have some special names to refer to the positions.
				// A,B: the start and end of the link.
				// C: the mouse position.
				// D: the perpendicular foot of the line AC on the line AB.
				// We need to find the point D.
				const link_horizontal_length: number = each_link.to.x - each_link.from.x;
				const link_vertical_length: number = each_link.to.y - each_link.from.y;
				const link_offset_x: number = (each_link_group[0].content.from.y - each_link_group[0].content.to.y) / link_length * link_offset;
				const link_offset_y: number = (each_link_group[0].content.from.x - each_link_group[0].content.to.x) / link_length * -link_offset;
				const link_from_x: number = each_link.from.x + link_offset_x;
				const link_from_y: number = each_link.from.y + link_offset_y;
				const link_to_x: number = each_link.to.x + link_offset_x;
				const link_to_y: number = each_link.to.y + link_offset_y;
				if (hover_place !== undefined
					&& ((link_from_x < hover_place.x && link_to_x > hover_place.x)
					|| (link_from_x > hover_place.x && link_to_x < hover_place.x)))
				{
					const A: Vector = new Vector([link_from_x, link_from_y]);
					const B: Vector = new Vector([link_to_x, link_to_y]);
					const C: Vector = new Vector([hover_place.x, hover_place.y]);
					const AB: Vector = B.minus(A)!;
					const AC: Vector = C.minus(A)!;
					const mouse_distance = Math.abs(AC.cross(AB) as unknown as number) / AB.length * 2;
					if (mouse_distance < each_link.style.width)
					{
						hovering = new star_map_elements.Interface(each_link, constants.storage.Link);
						if (this.debug)
						{
							StarMap.draw_line(context, link_from_x, link_from_y, link_to_x, link_to_y, each_link.style.width, constants.color.debug);
							continue;
						}
					}
				}
				// Step 4 - Draw the active link.
				if (each_link === this.active_element?.content ?? false)
				{
					StarMap.draw_line(context, link_from_x, link_from_y, link_to_x, link_to_y, each_link.style.width, constants.color.activate);
					continue;
				}
				// Step 5 - Optimize when the link is too thin to be displayed or the two colors are the same.
				if (each_link.style.width * this.content.zoom <= constants.display.thin_link_display_width || each_link.style.forecolor === each_link.style.backcolor)
				{
					StarMap.draw_line(context, link_from_x, link_from_y, link_to_x, link_to_y, each_link.style.width, each_link.style.forecolor);
					continue;
				}
				// Step 6 - Draw the link.
				const horizontal_ratio: number = link_horizontal_length / link_length;
				const vertical_ratio: number = link_vertical_length / link_length;
				const color_interval_count: number = Math.floor(link_length / each_link.style.width);
				const color_interval: number = link_length / color_interval_count;
				if (each_link_wrapper.onesided)
				{
					// "relative" means the relative position to the center of the node.
					const edge_midpoint_relative_x: number = - color_interval / 2 * horizontal_ratio;
					const edge_midpoint_relative_y: number = - color_interval / 2 * vertical_ratio;
					context.fillStyle = each_link.style.forecolor;
					for (let current_length: number = 0; current_length < link_length; current_length += color_interval)
					{
						const current_position_x: number = link_from_x + current_length * horizontal_ratio;
						const current_position_y: number = link_from_y + current_length * vertical_ratio;
						context.fillStyle = context.fillStyle === each_link.style.forecolor ? each_link.style.backcolor : each_link.style.forecolor;
						context.beginPath();
						context.moveTo(current_position_x, current_position_y);
						context.lineTo(current_position_x + edge_midpoint_relative_x - edge_midpoint_relative_y, current_position_y + edge_midpoint_relative_y + edge_midpoint_relative_x);
						context.lineTo(current_position_x - edge_midpoint_relative_x - edge_midpoint_relative_y, current_position_y - edge_midpoint_relative_y + edge_midpoint_relative_x)
						context.lineTo(current_position_x + color_interval * horizontal_ratio, current_position_y - 2 * edge_midpoint_relative_y);
						context.lineTo(current_position_x - edge_midpoint_relative_x + edge_midpoint_relative_y, current_position_y - edge_midpoint_relative_y - edge_midpoint_relative_x)
						context.lineTo(current_position_x + edge_midpoint_relative_x + edge_midpoint_relative_y, current_position_y + edge_midpoint_relative_y - edge_midpoint_relative_x);
						context.fill();
					}
				}
				else
				{
					context.lineWidth = each_link.style.width;
					context.strokeStyle = each_link.style.forecolor;
					for (let current_length: number = 0; current_length < link_length; current_length += color_interval)
					{
						context.strokeStyle = context.strokeStyle === each_link.style.forecolor ? each_link.style.backcolor : each_link.style.forecolor;
						context.beginPath();
						context.moveTo(link_from_x + current_length * horizontal_ratio, link_from_y + current_length * vertical_ratio);
						context.lineTo(link_from_x + (current_length + color_interval) * horizontal_ratio, link_from_y + (current_length + color_interval) * vertical_ratio);
						context.stroke();
					}
				}
			}
		}
		// Part 5 - Display the nodes and detect which node is hovered.
		for (const each_node of this.content.nodes)
		{
			// Step 1 - Draw the subject (circle).
			context.fillStyle = each_node.style.color;
			context.beginPath();
			context.arc(each_node.x, each_node.y, each_node.size, 0, 2 * Math.PI);
			context.fill();
			// Step 2 - Draw the active outline.
			if (each_node === this.active_element?.content ?? false)
			{
				context.strokeStyle = constants.color.activate;
				context.lineWidth = constants.display.activate_stroke;
				context.stroke();
			}
			// Step 3 - Detect the hovered node and highlight it when in debug mode.
			if (hover_place && (hover_place.x - each_node.x) ** 2 + (hover_place.y - each_node.y) ** 2 < each_node.size ** 2)
			{
				hovering = new star_map_elements.Interface(each_node, constants.storage.Node);
				if (this.debug)
				{
					context.fillStyle = constants.color.debug;
					context.fill();
				}
			}
			// Step 4 - Display the title of the node.
			if (each_node.size * this.content.zoom >= constants.display.small_node_display_size)
			{
				context.font = `${each_node.size}px ${constants.display.font}`;
				context.fillText(each_node.title, each_node.x, each_node.y + each_node.size * 2);
			}
		}
		// Part 6 - Return the coordinate when nothing is hovered.
		if (hover_place)
		{
			if (!hovering)
			{
				hovering = new star_map_elements.Interface(hover_place, constants.storage.Coordinate);
			}
			return hovering;
		}
	}
	public node_create(x: number, y: number, size: number, style: star_map_elements.NodeStyle, title: string = "", content: string = ""): star_map_elements.Node | undefined
	{
		if (size <= 0)
			return;
		const node: star_map_elements.Node = {
			x: x,
			y: y,
			size: size,
			style: style,
			title: title,
			content: content
		};
		this.content.nodes.push(node);
		this.history.snapshot();
		this.flush();
		return node;
	}
	public node_remove(node: star_map_elements.Node): void
	{
		const node_index = this.content.nodes.indexOf(node)
		if (node_index !== -1)
		{
			this.content.nodes.splice(node_index, 1);
			for (const [each_index, each_link] of this.content.links.entries())
			{
				if (each_link.from === node || each_link.to === node)
				{
					this.content.links.splice(each_index, 1);
				}
			}
			new Log("删除成功", "", "success");
		}
		else
		{
			new Log("删除失败", "", "error");
		}
		this.history.snapshot();
		this.flush();
	}
	public link_create(node1: star_map_elements.Node, node2: star_map_elements.Node, style: star_map_elements.LinkStyle, title: string = "", content: string = ""): star_map_elements.Link | undefined
	{
		if (node1 === node2)
		{
			new Log("创建失败", "不能链接自己", "error")
			return;
		}
		for (const each_link of this.content.links)
		{
			if (each_link.style == style && ((each_link.from == node1 && each_link.to == node2) || (!style.onesided && each_link.from == node2 && each_link.to == node1)))
			{
				new Log("创建失败", "已存在相同的连接", "error");
				return;
			}
		}
		const link: star_map_elements.Link = {
			from: node1,
			to: node2,
			style: style,
			title: title,
			content: content
		};
		this.content.links.push(link);
		this.history.snapshot();
		this.flush();
		return link;
	}
	public link_remove(link: star_map_elements.Link): void
	{
		const link_index: number = this.content.links.indexOf(link);
		if (link_index !== -1)
		{
			this.content.links.splice(link_index, 1);
			new Log("删除成功", "", "success");
		}
		else
		{
			new Log("删除失败", "", "error");
			return;
		}
		this.history.snapshot();
		this.flush();
	}
	public node_style_create(color: string, name="Style"): star_map_elements.NodeStyle
	{
		const style: star_map_elements.NodeStyle = {
			color: color,
			name: name
		};
		this.content.styles.node.push(style);
		this.history.snapshot();
		this.flush();
		return style;
	}
	public node_style_remove(style: star_map_elements.NodeStyle, move_target: star_map_elements.NodeStyle): boolean
	{
		if (!this.content.styles.node.includes(move_target))
		{
			new Log("节点样式删除失败", "为拥有该节点样式的元素指定的替换样式不存在", "error");
			return false;
		}
		this.content.styles.node.splice(this.content.styles.node.indexOf(style), 1);
		for (const each_node of this.content.nodes)
		{
			if (each_node.style === style)
			{
				each_node.style = move_target;
			}
		}
		this.history.snapshot();
		this.flush();
		return true;
	}
	public link_style_create(forecolor: string, backcolor: string, onesided: boolean, width: number, name: string = "Style"): star_map_elements.LinkStyle | undefined
	{
		if (width <= 0)
		{
			return;
		}
		const style: star_map_elements.LinkStyle = {
			forecolor: forecolor,
			backcolor: backcolor,
			onesided: onesided,
			width: width,
			name: name
		};
		this.content.styles.link.push(style);
		this.history.snapshot();
		this.flush();
		return style;
	}
	public link_style_remove(style: star_map_elements.LinkStyle, move_target: star_map_elements.LinkStyle): boolean
	{
		if (!this.content.styles.link.includes(move_target))
		{
			new Log("链接样式删除失败", "为拥有该链接样式的元素指定的替换样式不存在", "error");
			return false;
		}
		this.content.styles.link.splice(this.content.styles.link.indexOf(style), 1);
		for (const each_link of this.content.links)
		{
			if (each_link.style === style)
			{
				each_link.style = move_target;
			}
		}
		this.history.snapshot();
		this.flush();
		return true;
	}
	public async file_list_update(): Promise<void>
	{
		while (this.list.childElementCount > 2)
		{
			this.list.children[2].remove();
		}
		for (const each_key of await tools_database.get_keys(constants.data_namespace))
		{
			const option_element = document.createElement("option")
			option_element.innerText = option_element.value = each_key as string;
			this.list.appendChild(option_element);
		}
	}
	public async file_open(id: string): Promise<boolean>
	{
		let content: star_map_elements.Content;
		try
		{
			content = (await tools_database.get_data(constants.data_namespace, id)).content;
		}
		catch (error)
		{
			new Log("无法打开星图", `名字为${id}`, "error");
			return false;
		}
		if (content.version !== constants.current_version)
		{
			new Log("无法打开星图", `星图版本不匹配，请查看帮助文档进行升级或降级\n保存时的版本号为 ${content.version !== undefined ? content.version : 0}\n需要的版本号为 ${constants.current_version}`, "error");
			return false;
		}
		this.content = content;
		document.body.classList.add("editing");
		this.file_name = id;
		this.history.clear();
		this.history.snapshot();
		this.flush();
		return true;
	}
	public async file_create(id: string): Promise<void>
	{
		if ((await tools_database.get_keys(constants.data_namespace)).includes(id))
		{
			new Log("星图已存在", `名字为${id}`, "error");
			return;
		}
		if (!id)
		{
			return;
		}
		if (id === "NOT_SELECTED" || id === "NEW")
		{
			new Log("请换个星图名", "星图名与程序关键字重名", "error");
			return;
		}
		this.content = constants.defaults.content;
		document.body.classList.add("editing");
		this.file_name = id;
		this.file_save();
		await this.file_list_update();
		this.history.clear();
		this.history.snapshot();
	}
	public async file_save(): Promise<void>
	{
		await tools_database.write_to_data(constants.data_namespace, this.file_name, this.content);
		new Log("星图已保存", `名字为${this.file_name}`, "success");
	}
	public async file_close(): Promise<void>
	{
		document.body.classList.remove("editing");
		this.content = constants.defaults.content;
		this.file_name = "";
		this.history.clear();
		this.flush();
	}
}
class Log
{
	private readonly element: HTMLDivElement;
	constructor(title: string, content: string, type: "info" | "success" | "error" = "info")
	{
		this.element = document.createElement("div");
		document.getElementById("log")!.appendChild(this.element);
		this.element.classList.add(type);
		const title_element: HTMLHeadingElement = document.createElement("h2");
		title_element.innerText = title;
		const content_element: HTMLParagraphElement = document.createElement("p");
		content_element.innerText = content;
		this.element.appendChild(title_element);
		this.element.appendChild(content_element);
		const log_element = this.element;
		setTimeout(() => { log_element.remove(); }, constants.log_fade_time);
	}
	public remove()
	{
		this.element.remove();
	}
}
namespace user
{
	export let right_clicked_element: star_map_elements.Interface | undefined = undefined;
	export class SingleTriggerManager
	{
		/* --- SingleTriggerManager ---
		This class can handle multi-step functions, like moving a node.
		It can pause the function and resume it when the user has done a new action.
		1.	To use this class, you should call the "set" function with a generator function.
			The generator function should yield a requirement, which determines what the user should do next.
			For example, you can yield a function that waits for the user to click on a node, which looks like this:
			yield () => { manager.left_click_element(canvas, [constants.storage.Node]) }
			where the "manager" is the instance of this class.
		2.	The place where the generator function is paused will be resumed with a new parameter: the result that the user has done.
			In the last example, the function will be resumed with a parameter: element_types.Interface.
			You can hold the new parameter by assigning it to a variable, like this:
			const clicked_element = yield () => { manager.left_click_element(canvas, [constants.storage.Node]) }
		*/
		private current_listener?: {
			readonly target: HTMLElement,
			readonly type: string,
			readonly callback: (event: any) => void
		};
		private current_task?: Generator<() => void, undefined, any> // should yield a requirement defined in this class
		public get empty(): boolean
		{
			return this.current_task === undefined;
		}
		private remove_listener(): void
		{
			if (this.current_listener === undefined)
				return;
			this.current_listener.target.removeEventListener(this.current_listener.type, this.current_listener.callback);
			this.current_listener = undefined;
		}
		public set(task: Generator<() => void, undefined, any>): void
		{
			this.remove_listener();
			this.current_task = task;
			const requirement: (() => void) | undefined = this.current_task.next(event).value;
			if (requirement === undefined) // task undefined
			{
				this.current_task = undefined;
				return;
			}
			requirement();
		}
		private loop(event: any): void
		{
			this.remove_listener();
			if (this.current_task === undefined)
				return;
			const requirement: (() => void) | undefined = this.current_task.next(event).value;
			if (requirement === undefined) // task finished
			{
				this.current_task = undefined;
				return;
			}
			requirement();
		}
		public left_click_id(id: string): void | never
		{
			const target: HTMLElement | null = document.getElementById(id);
			if (target === null)
				throw new Error("Element not found");
			this.current_listener = {
				target: target,
				type: "click",
				callback: (event: MouseEvent) => {
					if (event.button === constants.mouse_button.left)
						this.loop(event);
				}
			};
			target.addEventListener("click", this.current_listener.callback);
		}
		public left_click_element(canvas: HTMLCanvasElement, types: ReadonlyArray<constants.storage>): void
		{
			this.current_listener = {
				target: canvas,
				type: "click",
				callback: (event: MouseEvent) => {
					if (event.button === constants.mouse_button.left)
					{
						const element: star_map_elements.Interface | undefined = current_star_map.flush(current_star_map.transform_into_canvas(event));
						if (element === undefined || !types.includes(element.type))
						{
							const types_string: string = types.map((each_type) => constants.element_translate_name.get(each_type)).join("或");
							new Log("请点击正确的位置", `你需要点击${types_string}`, "error");
							return;
						}
						this.loop(element);
					}
				}
			};
			canvas.addEventListener("click", this.current_listener.callback);
		}
	}
	export namespace auto_typesetting
	{
		export let enabled: boolean = false;
		export function switch_on_off(): void
		{
			enabled = !enabled;
			if (enabled)
			{
				document.getElementById("auto_typesetting")!.style.backgroundColor = "#66AA66";
			}
			else
			{
				document.getElementById("auto_typesetting")!.removeAttribute("style");
			}
		}
		export function tick(): void
		{
			if (!enabled)
			{
				return;
			}
			const forces: Map<star_map_elements.Node, {x: number, y: number}> = new Map();
			for (const each_node1 of current_star_map.content.nodes)
			{
				const force = {x: 0, y: 0};
				for (const each_link of current_star_map.content.links)
				{
					if (each_node1 !== each_link.from && each_node1 !== each_link.to)
					{
						continue;
					}
					const each_node2: star_map_elements.Node = each_link.from === each_node1 ? each_link.to : each_link.from;
					const distance: number = Math.sqrt((each_node1.x - each_node2.x) ** 2 + (each_node1.y - each_node2.y) ** 2);
					const horizontal_ratio: number = (each_node1.x - each_node2.x) / distance;
					const vertical_ratio: number = (each_node1.y - each_node2.y) / distance;
					const force_factor: number = constants.format.node_distance * each_node1.size * each_node2.size;
					const force_size: number = Math.log(distance) - force_factor / distance;
					force.x -= force_size * horizontal_ratio;
					force.y -= force_size * vertical_ratio;
				}
				for (const each_node2 of current_star_map.content.nodes)
				{
					if (each_node1 === each_node2)
					{
						continue;
					}
					const distance: number = Math.sqrt((each_node1.x - each_node2.x) ** 2 + (each_node1.y - each_node2.y) ** 2);
					const horizontal_ratio: number = (each_node1.x - each_node2.x) / distance;
					const vertical_ratio: number = (each_node1.y - each_node2.y) / distance;
					const force_factor: number = constants.format.node_distance * each_node1.size * each_node2.size;
					const force_size: number = (Math.log(distance) - force_factor / distance) * constants.format.node_no_link_force_factor;
					if (force_size > 0) // Pull together
						continue;
					force.x -= force_size * horizontal_ratio;
					force.y -= force_size * vertical_ratio;
				}
				forces.set(each_node1, force);
			}
			for (const each_node of current_star_map.content.nodes)
			{
				each_node.x += forces.get(each_node)!.x;
				each_node.y += forces.get(each_node)!.y;
			}
			current_star_map.flush();
		}
	}
	export namespace file
	{
		export async function select_file(): Promise<void>
		{
			const id: string = (document.getElementById("saves_option") as HTMLSelectElement).value;
			switch (id)
			{
				case "NEW":
					(document.getElementById("new_star_map") as HTMLDialogElement).showModal();
					(document.getElementById("saves_option") as HTMLSelectElement).value = "NOT_SELECTED";
					break;
				case "NOT_SELECTED":
					current_star_map.file_close();
					break;
				default:
					const success: boolean = await current_star_map.file_open(id);
					if (!success)
					{
						(document.getElementById("saves_option") as HTMLSelectElement).value = "NOT_SELECTED";
					}
					break;
			}
		}
		export async function confirm_create(): Promise<void>
		{
			const id = (document.getElementById("new_star_map-name") as HTMLInputElement).value;
			await current_star_map.file_create(id);
			(document.getElementById("saves_option") as HTMLSelectElement).value = id;
		}
	}
	export namespace input
	{
		type pseudo_mouse_event = Readonly<interfaces.Point2D> & {readonly button: constants.mouse_button};
		export const trigger_manager = new SingleTriggerManager();
		let drag_base: interfaces.Point2D | {x: undefined, y: undefined} = {x: undefined, y: undefined};
		export function mouse_down(event: pseudo_mouse_event): void
		{
			if (event.button === constants.mouse_button.left)
			{
				drag_base.x = event.x;
				drag_base.y = event.y;
			}
		}
		export function mouse_move(event: pseudo_mouse_event & {readonly movementX: number, readonly movementY: number}): void
		{
			if (event.button === constants.mouse_button.left)
			{
				if (drag_base.x === undefined) // not pressed
				{
					if (current_star_map.debug)
					{
						current_star_map.flush(current_star_map.transform_into_canvas(event));
					}
				}
				else // mouse pressed
				{
					current_star_map.move({ x: event.movementX * constants.display.canvas_scale, y: event.movementY * constants.display.canvas_scale });
				}
			}
		}
		export function mouse_up(event: pseudo_mouse_event): void
		{
			if (event.button === constants.mouse_button.left)
			{
				// The "drag" part is dealt in the "mouse_move" function.
				if (drag_base.x === undefined) // not pressed in the canvas
					return;
				if (drag_base.x === event.x && drag_base.y === event.y) // click
				{
					const active_element = current_star_map.flush(current_star_map.transform_into_canvas(event));
					left_click(event);
				}
				drag_base = {x: undefined, y: undefined};
			}
		}
		export function mouse_wheel(event: {readonly preventDefault: () => unknown, readonly deltaX: number, readonly deltaY: number, readonly deltaZ: number}): void
		{
			event.preventDefault();
			current_star_map.zoom(- event.deltaX - event.deltaY - event.deltaZ);
		}
		export function key(event: KeyboardEvent): void
		{
			const canvas_center = {x: current_star_map.canvas.offsetLeft + current_star_map.canvas.offsetWidth / 2, y: current_star_map.canvas.offsetTop + current_star_map.canvas.offsetHeight / 2};
			switch (event.key)
			{
				case constants.key.up:
					current_star_map.move({ x: 0, y: constants.motion.keyboard_drag_speed });
					break;
				case constants.key.down:
					current_star_map.move({ x: 0, y: -constants.motion.keyboard_drag_speed });
					break;
				case constants.key.right:
					current_star_map.move({ x: -constants.motion.keyboard_drag_speed, y: 0 });
					break;
				case constants.key.left:
					current_star_map.move({ x: constants.motion.keyboard_drag_speed, y: 0 });
					break;
				case constants.key.zoom_in:
					current_star_map.zoom(constants.motion.keyboard_zoom_speed);
					break;
				case constants.key.zoom_out:
					current_star_map.zoom(-constants.motion.keyboard_zoom_speed);
					break;
				case constants.key.choose:
					left_click({ x: canvas_center.x, y: canvas_center.y });
					break;
				case constants.key.right_click:
					const center_position = {
						clientX: canvas_center.x,
						clientY: canvas_center.y
					};
					right_click(Object.assign(event, center_position));
					break;
				case constants.key.undo:
					if (event.ctrlKey)
						current_star_map.history.undo();
					break;
				case constants.key.redo:
					if (event.ctrlKey)
						current_star_map.history.redo();
					break;
			}
		}
		export function right_click(event: {clientX: number, clientY: number, preventDefault: () => void}): void
		{
			event.preventDefault();
			const menus: Map<string, HTMLMenuElement> = new Map();
			for (const each_menu of document.querySelectorAll("menu"))
			{
				if (!each_menu.dataset.context_type)
					continue;
				menus.set(each_menu.dataset.context_type, each_menu);
				each_menu.removeAttribute("style");
			}
			const active_element: star_map_elements.Interface = current_star_map.flush(current_star_map.transform_into_canvas({ x: event.clientX, y: event.clientY }));
			right_clicked_element = active_element;
			for (const [each_element_type, each_menu_name] of constants.element_context_menu.entries())
			{
				if (active_element.type === each_element_type)
				{
					menus.get(each_menu_name)!.style.display = "flex";
					break;
				}
			}
		}
		export function left_click(position: interfaces.Point2D): void
		{
			const element: star_map_elements.Interface = current_star_map.flush(current_star_map.transform_into_canvas(position));
			if (trigger_manager.empty)
			{
				if (element.type === constants.storage.Coordinate)
					current_star_map.deactivate();
				else
					current_star_map.activate(element);
			}
			for (const each_menu of document.querySelectorAll("menu"))
			{
				if (!each_menu.dataset.context_type)
					continue;
				each_menu.removeAttribute("style");
			}
		}
		export function keyboard_click(event: KeyboardEvent): void
		{
			if (event.key === constants.key.choose || event.key === constants.key.right_click)
				(event.target as HTMLElement).click();
		}
	}
	export namespace content
	{
		export function open_dialog(): void
		{
			if (right_clicked_element === undefined || !("content" in right_clicked_element.content))
				return;
			const content_edit_screen = document.getElementById("content_edit") as HTMLDialogElement;
			content_edit_screen.querySelector("textarea")!.value = right_clicked_element.content.content;
			preview();
			content_edit_screen.showModal();
		}
		export function preview(): void
		{
			const preview_screen: HTMLElement = document.querySelector("#content_edit article")!;
			const source: HTMLTextAreaElement = document.querySelector("#content_edit textarea")!;
			const parser: parse_source.Parser = new parse_source.Parser();
			parser.source = source.value;
			parser.target = preview_screen;
			parser.parse();
		}
		export function finish_dialog(): void
		{
			if (right_clicked_element === undefined || !("content" in right_clicked_element.content))
				return;
			right_clicked_element.content.content = (document.querySelector("#content_edit textarea") as HTMLTextAreaElement).value;
			current_star_map.history.snapshot();
		}
	}
	export namespace node
	{
		export function create_dialog(): void
		{
			node_style.update();
			(document.getElementById("node_edit") as HTMLDialogElement).showModal();
		}
		export function modify_dialog(): void
		{
			const current_editing_element: star_map_elements.Interface | undefined = right_clicked_element;
			if (current_editing_element?.type !== constants.storage.Node ?? true)
				return;
			const editing_node = current_editing_element!.content as star_map_elements.Node;
			(document.getElementById("node_edit-title") as HTMLInputElement).value = editing_node.title;
			(document.getElementById("node_edit-size") as HTMLInputElement).value = editing_node.size.toString();
			node_style.update();
			(document.getElementById("node_edit") as HTMLDialogElement).showModal();
		}
		export function confirm_edit(): void
		{
			const chosen_style: star_map_elements.NodeStyle | undefined = (document.querySelector("#node_edit choose-list") as ChooseListElement<star_map_elements.NodeStyle>).value;
			// Although it's a div, it can actually select things and they are stored in the value property.
			const node_title: string = (document.getElementById("node_edit-title") as HTMLInputElement).value;
			const node_size: number = Number((document.getElementById("node_edit-size") as HTMLInputElement).value);
			const current_editing_element: star_map_elements.Interface | undefined = right_clicked_element;
			if (current_editing_element === undefined)
			{
				new Log("没有选中任何东西", "你必须选中一个东西才能编辑或创建", "error");
				return;
			}
			if (!chosen_style)
			{
				(document.getElementById("node_edit-title") as HTMLInputElement).setCustomValidity("你还没有选择样式");
				return;
			}
			(document.getElementById("node_edit-title") as HTMLInputElement).setCustomValidity("");
			if (current_editing_element.type === constants.storage.Coordinate) // create
			{
				const position = current_editing_element.content as star_map_elements.Coordinate;
				current_star_map.node_create(position.x, position.y, node_size, chosen_style, node_title);
			}
			else if (current_editing_element.type === constants.storage.Node) // modify
			{
				const editing_node = current_editing_element.content as star_map_elements.Node;
				editing_node.size = node_size;
				editing_node.style = chosen_style;
				editing_node.title = node_title;
				current_star_map.flush();
				current_star_map.history.snapshot();
			}
		}
		export function* move(trigger_manager: SingleTriggerManager): Generator<() => void, undefined, star_map_elements.Interface>
		{
			const element = right_clicked_element;
			if (element === undefined || element.type !== constants.storage.Node)
				return;
			const target = (yield () => { trigger_manager.left_click_element(document.getElementById("canvas") as HTMLCanvasElement, [constants.storage.Coordinate]) }).content as star_map_elements.Coordinate;
			const editing_node = element.content as star_map_elements.Node;
			editing_node.x = target.x;
			editing_node.y = target.y;
			current_star_map.flush();
			current_star_map.history.snapshot();
			return;
		}
		export function remove(): void
		{
			if (right_clicked_element === undefined || right_clicked_element.type !== constants.storage.Node)
				return;
			current_star_map.node_remove((right_clicked_element.content as star_map_elements.Node));
		}
	}
	export namespace node_style
	{
		export function update(): void
		{
			const target: ChooseListElement<star_map_elements.NodeStyle> = document.querySelector("#node_edit choose-list")!;
			target.clear();
			for (const each_style of current_star_map.content.styles.node)
			{
				const each_style_element = target.add(each_style, each_style.name);
				each_style_element.style.backgroundColor = each_style.color;
				each_style_element.onkeydown = (event: KeyboardEvent) => {
					if (event.key === constants.key.remove)
						input.trigger_manager.set(remove(each_style, input.trigger_manager));
				};
			}
		}
		export function create_dialog(): void
		{
			(document.getElementById("new_node_style") as HTMLDialogElement).showModal();
		}
		export function confirm_create(): void
		{
			const style_name: string = (document.getElementById("new_node_style-name") as HTMLInputElement).value;
			const style_color: string = (document.getElementById("new_node_style-color") as HTMLInputElement).value;
			current_star_map.node_style_create(style_color, style_name);
			update();
			new Log("节点样式创建成功", `名叫${style_name}`, "success");
		}
		export function* remove(style: star_map_elements.NodeStyle, trigger_manager: SingleTriggerManager): Generator<() => void, undefined, unknown>
		{
			const remove_dialog_element = document.getElementById("remove_node_style") as HTMLDialogElement;
			const move_target_choose_list = remove_dialog_element.querySelector("choose-list") as ChooseListElement<star_map_elements.NodeStyle>;
			move_target_choose_list.clear();
			for (const each_style of current_star_map.content.styles.node)
			{
				if (each_style === style)
					continue;
				const each_style_element = move_target_choose_list.add(each_style, each_style.name);
				each_style_element.style.backgroundColor = each_style.color;
			}
			remove_dialog_element.showModal();
			yield () => { trigger_manager.left_click_id("button_remove_node_style") };
			let move_target: star_map_elements.NodeStyle | undefined = move_target_choose_list.value;
			while (move_target === undefined)
			{
				new Log("节点样式删除失败", "你必须指定这个样式删除后带有这个样式的节点应该拥有的新样式", "error");
				yield () => { trigger_manager.left_click_id("button_remove_node_style") };
				move_target = move_target_choose_list.value;
			}
			current_star_map.node_style_remove(style, move_target);
			update();
			remove_dialog_element.close();
		}
	}
	export namespace link
	{
		export function* confirm_edit_link(trigger_manager: SingleTriggerManager): Generator<() => void, undefined, star_map_elements.Interface>
		{
			const chosen_style: star_map_elements.LinkStyle | undefined = (document.querySelector("#link_edit choose-list") as ChooseListElement<star_map_elements.LinkStyle>).value;
			// Although it's a div, it can actually select things and they are stored in the value property.
			const link_title: string = (document.getElementById("link_edit-title") as HTMLInputElement).value;
			const current_editing_element: star_map_elements.Interface | undefined = right_clicked_element;
			if (!current_editing_element)
			{
				new Log("没有选中任何东西", "你必须选中一个东西才能编辑或创建", "error");
				return;
			}
			if (!chosen_style)
			{
				(document.getElementById("link_edit-title") as HTMLInputElement).setCustomValidity("你还没有选择样式");
				return;
			}
			(document.getElementById("link_edit-title") as HTMLInputElement).setCustomValidity("");
			if (current_editing_element.type === constants.storage.Node)
			{
				const second_node = (yield () => { trigger_manager.left_click_element(document.getElementById("canvas") as HTMLCanvasElement, [constants.storage.Node]) }).content as star_map_elements.Node;
				current_star_map.link_create((current_editing_element.content as star_map_elements.Node), second_node, chosen_style, link_title);
				return;
			}
			else if (current_editing_element.type === constants.storage.Link)
			{
				const editing_link = current_editing_element.content as star_map_elements.Link;
				editing_link.style = chosen_style;
				editing_link.title = link_title;
				current_star_map.flush();
				current_star_map.history.snapshot();
			}
		}
		export function create(): void
		{
			link_style.update();
			(document.getElementById("link_edit") as HTMLDialogElement).showModal();
		}
		export function modify(): void
		{
			const current_editing_element: star_map_elements.Interface | undefined = right_clicked_element;
			if (current_editing_element?.type !== constants.storage.Link ?? true)
				return;
			const editing_link = current_editing_element!.content as star_map_elements.Link;
			(document.getElementById("link_edit-title") as HTMLInputElement).value = editing_link.title;
			link_style.update();
			(document.getElementById("link_edit") as HTMLDialogElement).showModal();
		}
		export function remove(): void
		{
			if (right_clicked_element === undefined || right_clicked_element.type !== constants.storage.Link)
				return;
			current_star_map.link_remove((right_clicked_element.content as star_map_elements.Link));
		}
	}
	export namespace link_style
	{
		export function update(): void
		{
			const target: ChooseListElement<star_map_elements.LinkStyle> = document.querySelector("#link_edit choose-list")!;
			target.clear();
			for (const each_style of current_star_map.content.styles.link)
			{
				const each_style_element = target.add(each_style, each_style.name);
				each_style_element.style.backgroundColor = each_style.backcolor;
				each_style_element.style.color = each_style.forecolor;
				each_style_element.onkeydown = (event: KeyboardEvent) => {
					if (event.key === constants.key.remove)
						input.trigger_manager.set(remove(each_style, input.trigger_manager));
				};
			}
		}
		export function create_dialog(): void
		{
			(document.getElementById("new_link_style") as HTMLDialogElement).showModal();
		}
		export function confirm_create(): void
		{
			const style_name: string = (document.getElementById("new_link_style-name") as HTMLInputElement).value;
			const style_forecolor: string = (document.getElementById("new_link_style-forecolor") as HTMLInputElement).value;
			const style_backcolor: string = (document.getElementById("new_link_style-backcolor") as HTMLInputElement).value;
			const style_onesided: boolean = (document.getElementById("new_link_style-onesided") as HTMLInputElement).checked;
			const style_width: number = Number((document.getElementById("new_link_style-width") as HTMLInputElement).value);
			current_star_map.link_style_create(style_forecolor, style_backcolor, style_onesided, style_width, style_name);
			update();
			new Log("链接样式创建成功", `名叫${style_name}`, "success");
		}
		export function* remove(style: star_map_elements.LinkStyle, trigger_manager: SingleTriggerManager): Generator<() => void, undefined, unknown>
		{
			const remove_dialog_element = document.getElementById("remove_link_style") as HTMLDialogElement;
			const move_target_choose_list = remove_dialog_element.querySelector("choose-list") as ChooseListElement<star_map_elements.LinkStyle>;
			move_target_choose_list.clear();
			for (const each_style of current_star_map.content.styles.link)
			{
				if (each_style === style)
					continue;
				const each_style_element = move_target_choose_list.add(each_style, each_style.name);
				each_style_element.style.backgroundColor = each_style.backcolor;
				each_style_element.style.color = each_style.forecolor;
			}
			remove_dialog_element.showModal();
			yield () => { trigger_manager.left_click_id("button_remove_link_style") };
			let move_target: star_map_elements.LinkStyle | undefined = move_target_choose_list.value;
			while (move_target === undefined)
			{
				new Log("链接样式删除失败", "你必须指定这个样式删除后带有这个样式的链接应该拥有的新样式", "error");
				yield () => { trigger_manager.left_click_id("button_remove_link_style") };
				move_target = move_target_choose_list.value;
			}
			current_star_map.link_style_remove(style, move_target);
			update();
			remove_dialog_element.close();
		}
	}
	export namespace search
	{
		export function dialog(): void
		{
			(document.getElementById("search_window") as HTMLDialogElement).showModal();
		}
		export function finish_dialog(): void
		{
			const search_title: string = (document.getElementById("search_window-title") as HTMLInputElement).value;
			const search_content: string = (document.getElementById("search_window-content") as HTMLInputElement).value;
			const is_regex: boolean = (document.getElementById("search_window-regex") as HTMLInputElement).checked;
			const search_type: string = (document.querySelector("dialog#search_window input[name='search_window-type']:checked") as HTMLInputElement).value;
			const title_regex: string | RegExp = is_regex ? search_title : new RegExp(search_title);
			const content_regex: string | RegExp = is_regex ? search_content : new RegExp(search_content);
			let elements: Array<star_map_elements.Link> | Array<star_map_elements.Node> = [];
			let element_index: number = -1;
			switch (search_type)
			{
				case "link":
					elements = Array.from(current_star_map.content.links);
					break;
				case "node":
					elements = Array.from(current_star_map.content.nodes);
					break;
			}
			// Skip the searched elements first.
			for (; (elements[element_index] !== current_star_map.active_element?.content && element_index < elements.length) ?? false; element_index ++);
			for (const each_element of elements.slice(element_index + 1))
			{
				if (each_element.title.match(title_regex) !== null && each_element.content.match(content_regex) !== null)
				{
					switch (search_type)
					{
						case "link":
							current_star_map.activate(new star_map_elements.Interface(each_element, constants.storage.Link));
							const editing_link = each_element as star_map_elements.Link;
							current_star_map.content.x = -(editing_link.from.x + editing_link.to.x) / 2 * current_star_map.content.zoom;
							current_star_map.content.y = -(editing_link.from.y + editing_link.to.y) / 2 * current_star_map.content.zoom;
							break;
						case "node":
							current_star_map.activate(new star_map_elements.Interface(each_element, constants.storage.Node));
							const editing_node = each_element as star_map_elements.Node;
							current_star_map.content.x = -editing_node.x * current_star_map.content.zoom;
							current_star_map.content.y = -editing_node.y * current_star_map.content.zoom;
							break;
					}
					current_star_map.flush();
					break;
				}
			}
		}
	}
}

export const current_star_map = new StarMap(
	document.getElementById("canvas") as HTMLCanvasElement,
	document.getElementById("saves_option") as HTMLSelectElement);

window.addEventListener("DOMContentLoaded", () => {
	for (const each_dialog of document.querySelectorAll("dialog"))
	{
		(each_dialog.querySelector("button[value=cancel]") as HTMLButtonElement)!.onclick = 
			() => {each_dialog.close();};
	}
	current_star_map.file_list_update();
	const details_area: HTMLElement = document.getElementById("details")!;
	new AnimationHandler(details_area).transition_function = function (){
		current_star_map.flush();
	}
	details_area.style.width = "0px";
	setInterval(user.auto_typesetting.tick, constants.format.tick_interval)
});

window.addEventListener("beforeunload", (event: BeforeUnloadEvent) => {
	if (current_star_map.file_name)
	{
		event.preventDefault();
	}
});

customElements.define("choose-list", ChooseListElement);
customElements.define("choose-item", ChooseItemElement);

window.addEventListener("resize", () => {current_star_map.flush();});

document.getElementById("canvas")!.onmousedown = (event) => { user.input.mouse_down(event); };
document.getElementById("canvas")!.onmousemove = (event) => { user.input.mouse_move(event); };
document.getElementById("canvas")!.onmouseup = (event) => { user.input.mouse_up(event); };
document.getElementById("canvas")!.onwheel = (event) => { user.input.mouse_wheel(event); };
document.getElementById("canvas")!.onkeydown = (event) => { user.input.key(event); };
document.getElementById("canvas")!.oncontextmenu = (event) => { user.input.right_click(event); };
document.getElementById("saves_option")!.onchange = () => { user.file.select_file(); };
document.getElementById("button_save")!.onclick = () => { current_star_map.file_save(); };
document.getElementById("button_typesetting")!.onclick = () => { user.auto_typesetting.switch_on_off(); };
document.getElementById("button_search_window")!.onclick = () => { user.search.dialog(); };
document.getElementById("button_new_node")!.onclick = () => { user.node.create_dialog(); };
document.getElementById("button_remove_node")!.onclick = () => { user.node.remove(); };
document.getElementById("button_move_node")!.onclick = () => { user.input.trigger_manager.set(user.node.move(user.input.trigger_manager)); };
document.getElementById("button_modify_node")!.onclick = () => { user.node.modify_dialog(); };
document.getElementById("button_node_modify_content")!.onclick = () => { user.content.open_dialog(); };
document.getElementById("button_new_link")!.onclick = () => { user.link.create(); };
document.getElementById("button_remove_link")!.onclick = () => { user.link.remove(); };
document.getElementById("button_modify_link")!.onclick = () => { user.link.modify(); };
document.getElementById("button_link_modify_content")!.onclick = () => { user.content.open_dialog(); };
document.getElementById("button_new_star_map")!.onclick = () => { user.file.confirm_create(); };
document.getElementById("button_add_node_style")!.onclick = () => {  user.node_style.create_dialog(); };
document.getElementById("button_add_node_style")!.onkeydown = (event) => { user.input.keyboard_click(event); };
document.getElementById("button_edit_node")!.onclick = () => { user.node.confirm_edit() };
document.getElementById("button_add_link_style")!.onclick = () => { user.link_style.create_dialog(); };
document.getElementById("button_add_link_style")!.onkeydown = (event) => { user.input.keyboard_click(event); };
document.getElementById("button_edit_link")!.onclick = () => { user.input.trigger_manager.set(user.link.confirm_edit_link(user.input.trigger_manager)); };
document.getElementById("button_new_node_style")!.onclick = () => { user.node_style.confirm_create(); };
document.getElementById("button_new_link_style")!.onclick = () => { user.link_style.confirm_create(); };
document.getElementById("button_edit_content")!.onclick = () => { user.content.finish_dialog(); };
document.getElementById("button_search")!.onclick = () => { user.search.finish_dialog(); };
document.getElementById("input_content")!.oninput = () => { user.content.preview(); };