export namespace parse_source
{
	export namespace environment
	{
		export let figure: string = "";
	}
	export namespace constant
	{
		export const chunk_concat_regexes: RegExp[] = [
			/^ *- /
		];
		export const paragraph_prefixes: Map<RegExp, string> = new Map([
			[/^NOTE /, "notice"],
			[/^WARN /, "warning"],
			[/^DEF /, "definition"]
		])
		export enum chunk_type
		{
			Paragraph,
			Comment,
			Heading,
			Tree,
			Interval,
			Figure
		};
		export const chunk_type_regexes: Map<RegExp, chunk_type> = new Map([
			[/^#+/, chunk_type.Heading],
			[/^ *- /, chunk_type.Tree],
			[/^===$/, chunk_type.Interval],
			[/^FIGURE /, chunk_type.Figure],
			[/^([ \t]*|<!-- .+ -->)$/, chunk_type.Comment],
			[/./, chunk_type.Paragraph] // Default
		]);
	}
	/* --- SOURCE Language Explanation ---
	In this language, symbols are mainly capital letters.
	1.	Blocks
		a.	Normal Text
			We use a single line to create a text (exactly <p>).
			We can add some symbols before it, like "NOTE", "WARN", "DEF" (for definition).
			e.g. NOTE This is a note
			     ^^^^ ^^^^^^^^^^^^^^
			    symbol  expression
		b.	Headings
			We use "#" to define headings. The more "#", the smaller heading.
			The smallest heading is <h6>.
			e.g. "#" refers to <h2>, "#####" and "######" refer to <h6>.
		c.	List
			We can't define an unordered list
			i.	Ordered List
				We use "-" to define an ordered list.
				Adding space before the "-" makes the entry smaller.
				e.g.
				- Caption 1
				  - SubCaption
				- Caption 2
				will produce
				1. Caption 1
				   1. Subcaption
				2. Caption 2
		d.	Interval
			We sometimes need some intervals between two headings.
			e.g.
			#Heading 1
			===
			#Heading 2
		e.	Figure
			We can use "FIGURE id" to insert a figure.
			The source <figure> with the id should be also in the file.
			Figures are numbered automatically.
			See "3. Environment".
	2.	Inlines
		Inline symbols are surrounded by "[]".
		a.	Link
			We can use [name TO target] to create a link.
			Add " BLANK" after "TO" to make the link "_blank".
			e.g. Go to [Github TO BLANK github.com]
		b.	Term
			We can use [NOUN term] to create a term.
			The [NOUN term AS description] is more commonly used.
		c.	Code
			We can use [CODE code] to create a piece of code.
	3.	Environment
		You should define all your environment settings in a variable called "parse_source.environment".
		a.	If you are using figures in2 your codes, you should define the attribute "figure" (string), with the number placeholder as "$".
			e.g. "Figure $" will be replaced into "Figure 1", "Figure 2", etc.
	*/
	class Chunk
	{
		readonly content: string;
		readonly type: constant.chunk_type;
		constructor(content: string)
		{
			this.content = content;
			this.type = constant.chunk_type.Paragraph;
			for (const [each_regex, each_type] of constant.chunk_type_regexes)
			{
				if (each_regex.test(content))
				{
					this.type = each_type;
					break;
				}
			}
		}
	}
	export class Parser
	{
		public source: string;
		public target?: HTMLElement;
		public target_nav?: HTMLElement;
		private figures: Array<HTMLElement>;
		constructor()
		{
			this.source = "";
			this.figures = [];
		}
		public parse()
		{
			// Part 1 - Detect errors
			if (this.source === "" || this.target === undefined)
				return false;
			// Part 2 - Divide chunks
			const chunks: Chunk[] = Parser.get_chunks(this.source);
			// Part 3 - Parse chunks
			const parse_results: [Chunk, HTMLElement][] = [];
			for (const each_chunk of chunks)
			{
				const chunk_result = this.parse_chunk(each_chunk);
				if (chunk_result !== undefined)
					parse_results.push([each_chunk, chunk_result]);
			}
			// Part 4 - Deploy chunks
			this.target.innerHTML = "";
			const section_stack: HTMLElement[] = [this.target];
			const nav_list_stack: HTMLElement[] = this.target_nav ? [this.target_nav] : [];
			const nav_item_stack: HTMLElement[] = [];
			for (const [each_chunk, each_result] of parse_results)
			{
				if (each_chunk.type === constant.chunk_type.Heading)
				{
					// Step 1 - Create and append to section.
					const heading_level: number = each_chunk.content.match(/^#+/)?.[0].length ?? 1;
					while (section_stack.length > heading_level)
						section_stack.pop();
					while (section_stack.length <= heading_level)
					{
						const new_section: HTMLElement = document.createElement("section");
						if (section_stack.length === 1)
							new_section.id = each_chunk.content.replace(/^#+/, "");
						else
							new_section.id = `${section_stack[section_stack.length - 1].id}-${each_chunk.content.replace(/^#+/, "")}`;
						section_stack[section_stack.length - 1].appendChild(new_section);
						section_stack.push(new_section);
					}
					// Step 2 - Add to nav.
					if (this.target_nav !== undefined)
					{
						let nav_indent: number = heading_level - 1;
						while (nav_indent < nav_list_stack.length - 1)
							nav_list_stack.pop();
						while (nav_indent < nav_item_stack.length - 1)
							nav_item_stack.pop();
						if (nav_indent > nav_list_stack.length)
							nav_indent = nav_list_stack.length;
						if (nav_indent === nav_list_stack.length)
						{
							const new_list: HTMLElement = document.createElement("ol");
							nav_list_stack.push(new_list)
							if (nav_indent > 0)
								nav_item_stack[nav_item_stack.length - 1].appendChild(new_list);
						}
						const nav_item: HTMLElement = document.createElement("li");
						nav_list_stack[nav_list_stack.length - 1].appendChild(nav_item);
						nav_item_stack.push(nav_item);
						const nav_link: HTMLAnchorElement = document.createElement("a");
						nav_link.href = `#${section_stack[section_stack.length - 1].id}`;
						nav_link.innerText = each_result.innerText;
						nav_item.appendChild(nav_link);
					}
				}
				section_stack[section_stack.length - 1].appendChild(each_result);
			}
		}
		private static get_chunks(source: string): Chunk[]
		{
			const areas: string[] = source.split(/\n/);
			let index: number = 0;
			while (index < areas.length - 1)
			{
				index ++;
				for (const each_regex of constant.chunk_concat_regexes)
				{
					if (each_regex.test(areas[index - 1]) && each_regex.test(areas[index]))
					{
						areas[index - 1] += "\n" + areas[index];
						areas.splice(index, 1);
						index --;
						break;
					}
				}
			}
			return areas.map(each_area => new Chunk(each_area));
		}
		public static attach(target: HTMLElement, elements: Iterable<Node>): void
		{
		    for (const each_element of elements)
		    {
		        target.appendChild(each_element);
		    }
		}
		private parse_chunk(chunk: Chunk): HTMLElement | undefined
		{
			switch (chunk.type)
			{
				case constant.chunk_type.Paragraph:
					let paragraph_content: string = chunk.content;
					const paragraph_element: HTMLElement = document.createElement("p");
					for (const [each_regex, each_class] of constant.paragraph_prefixes)
					{
						if (each_regex.test(paragraph_content))
						{
							paragraph_content = paragraph_content.replace(each_regex, "");
							paragraph_element.classList.add(each_class);
							break;
						}
					}
					Parser.attach(paragraph_element, this.parse_inline(paragraph_content));
					return paragraph_element;
				case constant.chunk_type.Heading:
					const heading_level = chunk.content.match(/^#+/)?.[0].length ?? 1;
					const heading_element: HTMLElement = document.createElement(`h${heading_level + 1 > 6 ? 6 : heading_level + 1}`); // h1 is used at the top of the document.
					Parser.attach(heading_element, this.parse_inline(chunk.content.replace(/^#+/, "")));
					return heading_element;
				case constant.chunk_type.Tree:
					const tree_lines: string[] = chunk.content.split(/\n/);
					const list_stack: HTMLElement[] = [];
					const element_stack: HTMLElement[] = [];
					for (const each_line of tree_lines)
					{
						let tree_indent: number = each_line.match(/^ +/)?.[0].length ?? 0;
						while (tree_indent < list_stack.length - 1)
							list_stack.pop();
						while (tree_indent < element_stack.length - 1)
							element_stack.pop();
						if (tree_indent > list_stack.length)
							tree_indent = list_stack.length;
						if (tree_indent === list_stack.length)
						{
							const new_list: HTMLElement = document.createElement("ol");
							list_stack.push(new_list);
							if (tree_indent > 0)
								element_stack[element_stack.length - 1].appendChild(new_list);
						}
						const list_item: HTMLElement = document.createElement("li");
						list_stack[list_stack.length - 1].appendChild(list_item);
						element_stack.push(list_item);
						Parser.attach(list_item, this.parse_inline(each_line.replace(/^ *- /, "")));
					}
					list_stack[0]?.classList.add("tree");
					return list_stack[0];
				case constant.chunk_type.Figure:
					const figure_id: string = chunk.content.replace(/^FIGURE /, "");
					const original_figure: HTMLElement | null = document.getElementById(figure_id);
					if (original_figure === null)
						return undefined;
					if (this.figures.indexOf(original_figure) === -1)
						this.figures.push(original_figure);
					const figure_display: HTMLElement = original_figure.cloneNode(true) as HTMLElement;
					figure_display.removeAttribute("id");
					const figure_caption: HTMLElement | null = figure_display.querySelector("figcaption");
					const figure_number: number = this.figures.indexOf(original_figure) + 1;
					if (figure_caption !== null)
						figure_caption.textContent = environment.figure.replace(/\$/g, figure_number.toString()) + figure_caption.innerText;
					return figure_display;
				case constant.chunk_type.Interval:
					return document.createElement("hr");
			}
		}
		private parse_inline(source: string): Node[]
		{
			const wrapper: HTMLElement = document.createElement("div");
			const current_parser = this;
			wrapper.innerHTML = source
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\[CODE (.*?)\]/g, "<code>$1</code>")
				.replace(/\[(.*?) TO BLANK (.*?)\]/g, "<a href=\"$2\" target=\"_blank\">$1</a>")
				.replace(/\[(.*?) TO (.*?)\]/g, "<a href=\"$2\">$1</a>")
				.replace(/\[NOUN (.*?) AS (.*?)\]/g, "<dfn title=\"$2\">$1</dfn>")
				.replace(/\[NOUN (.*?)\]/g, "<dfn>$1</dfn>")
				.replace(/\[VAR_TYPE (.*?)\]/g, "<span class=\"type\">$1</span>")
				.replace(/\[FIGURE (.+?)\]/g, function (match: string): string {
					for (const each_figure of current_parser.figures)
					{
						if (each_figure.id === match.match(/\[FIGURE (.+?)\]/)?.[1])
						{
							const figure_number: number = current_parser.figures.indexOf(each_figure) + 1
							return environment.figure.replace(/\$/g, figure_number.toString());
						}
					}
					return match;
				});
			const elements: Node[] = Array.from(wrapper.childNodes);
			return elements;
		}
	}
}

window.addEventListener("DOMContentLoaded", () => {
	const main_element = document.querySelector("main");
	const nav_element = document.querySelector("body>nav>ol.catalogue");
	if (main_element === null || nav_element === null)
		return;
	const parser = new parse_source.Parser();
	parser.target = main_element;
	parser.target_nav = nav_element as HTMLElement;
	parser.source = main_element.textContent?.replace(/\n\t*/g, "\n") ?? "";
	parser.parse();
})