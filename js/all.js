function update_content(source=undefined)
{
	/*
	--- Language Explanation ---
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
			ii.	Input / Output List
				We use "LIST input" or "LIST output" declared before a list to make it an input / output list.
				We shouldn't add space before these list entries.
				Sometimes we need to make this special list stop make the following lists returned to ordered lists, then we'll need "LIST end".
				e.g.
				LIST input
				- Input 1
				- Input 2
				LIST end
				- Normal list
		d.	Interval
			We sometimes need some intervals between two <h2>, so here comes the interval.
			We can use "===" to create an interval.
			The heading which follows an interval should be an <h2>, since intervals only appear there.
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
		You should define all your environment settings in a variable called "parse_environment".
		If you are using figures in your codes, you should define the attribute "figure" (string), with the number placeholder as "$".
	*/
	class InlineParser
	{
		constructor(target, block_parser)
		{
			this.target = target;
			this.figures = block_parser.figures;
			this.environment = block_parser.environment;
		};
		parse(content)
		{
			this.target.innerHTML = "";
			content = content
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/\[(.*?) TO BLANK (.*?)\]/g, "<a href=\"$2\" target=\"_blank\">$1</a>")
				.replace(/\[(.*?) TO (.*?)\]/g, "<a href=\"$2\">$1</a>")
				.replace(/\[NOUN (.*?) AS (.*?)\]/g, "<dfn title=\"$2\">$1</dfn>")
				.replace(/\[NOUN (.*?)\]/g, "<dfn>$1</dfn>")
				.replace(/\[VAR_TYPE (.*?)\]/g, "<span class=\"type\">$1</span>")
				.replace(/\[CODE (.*?)\]/g, "<code>$1</code>");
			const inline_parser = this;
			content = content.replace(/\[FIGURE (.+?)\]/g, function(match) {
				for (let each_figure of inline_parser.figures)
				{
					if (each_figure.id === match.match(/\[FIGURE (.+?)\]/)[1])
					{
						if (!inline_parser.environment.figure)
						{
							console.warn("The figure environment isn't defined.")
						};
						return inline_parser.environment.figure.replace(/\$/g, inline_parser.figures.indexOf(each_figure) + 1);
					};
				};
				return match;
			})
			this.target.innerHTML = content;
		};
		parse_io_list(content)
		{
			let content_variables = content.match(/\[VAR (.+?)\]/g)
			if (!content_variables)
			{
				this.parse(content);
				return;
			};
			for (let each_variable of content_variables)
			{
				content = content.replace(
					each_variable,
					each_variable.replace(/^\[VAR (.+) (.*?)\]$/, "[CODE [VAR_TYPE $1] $2]")
				);
			};
			this.parse(content);
		};
	};
	class BlockParser
	{
		constructor(target, nav = undefined)
		{
			this.target = target;
			this.section_stack = new Array(target);
			this.tree_stack = new Array();
			this.list_target = undefined;
			this.figures = new Array();
			this.environment = typeof parse_environment === "object" ? parse_environment : {}; // Defined in the html file.
			this.heading_id_counter = 0;
			if (nav && nav.querySelector("ol:empty"))
			{
				this.catalogues = new Array(nav.querySelector("ol:empty"));
			}
			else
			{
				this.catalogues = new Array(document.createElement("ol"));
				this.catalogues[0].classList.add("catalogue");
				if (nav !== undefined)
				{
					nav.appendChild(this.catalogues[0]);
				};
			};
		};
		parse(content)
		{
			let tabless_content = content.trimStart();
			if (!tabless_content)
			{
				return;
			}
			else if (tabless_content.match(/^#/))
			{
				this.parse_heading(tabless_content);
			}
			else if (tabless_content === "===")
			{
				this.parse_interval();
			}
			else if (this.list_target && tabless_content.match(/^- /))
			{
				this.parse_list(tabless_content);
			}
			else if (tabless_content.match(/^- |^-$/))
			{
				this.parse_tree(content);
			}
			else if (tabless_content.match(/^LIST .+/))
			{
				this.parse_list_begin_end(tabless_content);
			}
			else if (tabless_content.match(/^FIGURE .+/))
			{
				this.parse_figure(tabless_content);
			}
			else
			{
				this.parse_paragraph(tabless_content);
			};
		};
		parse_heading(content)
		{
			this.heading_id_counter++;
			let heading_level = content.match(/^#+/)[0].length;
			let heading_text = content.replace(/^#+/, "");
			if (heading_level > this.section_stack.length)
			{
				console.warn(`Heading level too high.\n at "${content}"`)
				heading_level = this.section_stack.length;
			};
			this.pop_section(heading_level);
			this.pop_catalogue(heading_level);
			let new_section = this.push_section();
			let new_heading = document.createElement(`h${heading_level + 1 > 6 ? 6 : heading_level + 1}`);
			new_heading.id = this.heading_id_counter;
			new_section.appendChild(new_heading);
			let line_parser = new InlineParser(new_heading, this);
			line_parser.parse(heading_text);
			let heading_id = `#${this.heading_id_counter}`;
			if (heading_level > this.catalogues.length) // higher level
			{
				this.push_catalogue(` ${heading_text}`, heading_id)
			}
			else
			{
				let new_catalogue_item = document.createElement("li");
				let new_link = document.createElement("a");
				new_link.href = heading_id;
				new_link.innerText = ` ${heading_text}`;
				new_catalogue_item.appendChild(new_link);
				this.catalogues[this.catalogues.length - 1].appendChild(new_catalogue_item);
			};
		};
		parse_interval()
		{
			this.pop_section(1);
			this.section_stack[this.section_stack.length - 1].appendChild(document.createElement("hr"));
		};
		parse_list(content)
		{
			content = content.match(/^- (.*)/)[1];
			let new_list_item = document.createElement("p");
			let line_parser = new InlineParser(new_list_item, this);
			if (this.list_target.classList.contains("input") || this.list_target.classList.contains("output"))
			{
				line_parser.parse_io_list(content);
			}
			else
			{
				line_parser.parse(content);
			}
			this.list_target.appendChild(new_list_item);
		};
		parse_tree(content)
		{
			if (content == "-")
			{
				this.tree_stack.length = 0;
				return;
			};
			let indents = content.match(/^( *)/)[0].length + 1;
			let line_content = content.replace(/^ *- /, "");
			if (indents > this.tree_stack.length + 1)
			{
				console.warn(`Tree level too high.\n at "${content}"`)
				indents = this.tree_stack.length + 1;
			};
			if (indents == this.tree_stack.length + 1)
			{
				let sub_tree = document.createElement("ol");
				if (this.tree_stack.length == 0)
				{
					sub_tree.classList.add("tree");
					this.section_stack[this.section_stack.length - 1].appendChild(sub_tree);
				}
				else
				{
					this.tree_stack[this.tree_stack.length - 1].lastChild.appendChild(sub_tree);
				};
				this.tree_stack.push(sub_tree);
			};
			let new_line = document.createElement("li");
			let line_parser = new InlineParser(new_line, this);
			line_parser.parse(` ${line_content}`);
			this.tree_stack[indents - 1].appendChild(new_line);
		};
		parse_list_begin_end(content)
		{
			let list_type = content.match(/^LIST (.+)/)[1];
			switch (list_type)
			{
				case "input":
					let new_io_container = document.createElement("div");
					this.section_stack[this.section_stack.length - 1].appendChild(new_io_container);
					new_io_container.classList.add("io");
					this.list_target = document.createElement("div");
					new_io_container.appendChild(this.list_target);
					this.list_target.classList.add("input");
					break;
				case "output":
					let current_io_container = this.section_stack[this.section_stack.length - 1].lastChild;
					if (!(current_io_container.firstChild instanceof HTMLDivElement && current_io_container.firstChild.classList.contains("input")))
					{
						console.warn("Output must follows an input");
						break;
					};
					this.list_target = document.createElement("div");
					current_io_container.appendChild(this.list_target);
					this.list_target.classList.add("output");
					break;
				case "end":
					this.list_target = undefined;
			};
		};
		parse_figure(content)
		{
			let figure_id = content.match(/^FIGURE (.+)/)[1];
			let origin_figure = document.getElementById(figure_id);
			if (!origin_figure)
			{
				console.warn(`Could not find figure ${figure_id}`);
				return;
			};
			if (!this.figures.includes(origin_figure))
			{
				this.figures.push(origin_figure);
			};
			let figure_number = this.figures.indexOf(origin_figure) + 1;
			let new_figure = origin_figure.cloneNode(true);
			new_figure.removeAttribute("id");
			let figure_caption = new_figure.querySelector("figcaption");
			if (figure_caption && this.environment.figure)
			{
				figure_caption.textContent = this.environment.figure.replace(/\$/g, figure_number) + figure_caption.innerText;
			};
			this.section_stack[this.section_stack.length - 1].appendChild(new_figure);
		};
		parse_paragraph(content)
		{
			let new_paragraph = document.createElement("p");
			let line_parser = new InlineParser(new_paragraph, this);
			line_parser.parse(content.replace(/^(NOTE|WARN|DEF) /, ""));
			this.section_stack[this.section_stack.length - 1].appendChild(new_paragraph);
			if (content.startsWith("NOTE"))
			{
				new_paragraph.classList.add("notice");
			}
			else if (content.startsWith("WARN"))
			{
				new_paragraph.classList.add("warning");
			}
			else if (content.startsWith("DEF"))
			{
				new_paragraph.classList.add("definition");
			};
		};
		push_section()
		{
			let new_section = document.createElement("section");
			this.section_stack[this.section_stack.length - 1].appendChild(new_section);
			this.section_stack.push(new_section);
			return new_section;
		};
		push_catalogue(content = undefined, target = undefined)
		{
			let new_catalogue = document.createElement("ol");
			this.catalogues[this.catalogues.length - 1].lastChild.appendChild(new_catalogue);
			this.catalogues.push(new_catalogue);
			if (content && target)
			{
				let new_catalogue_item = document.createElement("li");
				let new_link = document.createElement("a");
				new_link.innerText = content;
				new_link.href = target;
				new_catalogue_item.appendChild(new_link);
				new_catalogue.appendChild(new_catalogue_item);
			};
			return new_catalogue;
		};
		pop_section(level)
		{
			this.section_stack = this.section_stack.slice(0, level);
			return this.section_stack[level];
		};
		pop_catalogue(level)
		{
			this.catalogues = this.catalogues.slice(0, level);
			return this.catalogues[level];
		};
		finish_up()
		{
			if (!this.catalogues[0].innerHTML)
			{
				this.catalogues[0].remove();
			};
		};
	};
	let targets = source ? [source] : document.getElementsByTagName("main");
	let nav = document.getElementsByTagName("nav")[0];
	for (let target of targets)
	{
		if (!(target.dataset.type && target.dataset.type.includes("source")))
		{
			continue;
		};
		let content = target.textContent;
		target.innerText = "";
		let parser = new BlockParser(target, nav);
		for (let each_line of content.split("\n"))
		{
			parser.parse(each_line.replace(/^\t+/, ""));
		};
		delete target.dataset.type;
		parser.finish_up();
	};
	for (let source_element of document.getElementsByTagName("data-source"))
	{
		source_element.remove();
	};
};

function update_math()
{
	if (navigator.userAgent.includes("Chrome"))
	{
		document.documentElement.dataset.browser = "ms";
	}
	else
	{
		document.documentElement.dataset.browser = "webkit";
		for (let each_item of document.querySelectorAll("math:not([inline])"))
		{
			each_item.setAttribute("display", "block");
		};
	};
};

function update_pre()
{
	function add_lines(lines, element)
	{
		for (let each_line_index in lines)
		{
			let each_line = lines[each_line_index];
			let line_number = document.createElement("span");
			line_number.classList.add("line-number");
			line_number.innerText = Number(each_line_index) + 1;
			let line = document.createElement("span");
			line.classList.add("line");
			line.innerText += each_line;
			element.appendChild(line_number);
			element.appendChild(line);
		};
	};
	let elements = document.getElementsByTagName("pre");
	for (let each_element of elements)
	{
		let src = each_element.getAttribute("src");
		if (!src)
		{
			let original_text = each_element.innerText.trimEnd();
			let lines = new Array();
			let tabs = original_text.length - original_text.trimStart().length;
			each_element.innerText = "";
			for (let each_line of original_text.split("\n"))
			{
				lines.push(each_line.substring(tabs));
			};
			add_lines(lines, each_element);
		}
		else
		{
			let file_request = new XMLHttpRequest();
			file_request.open("GET", src, true);
			file_request.onload = function ()
			{
				if (file_request.status === 200)
				{
					let lines = file_request.responseText.split("\n");
					add_lines(lines, each_element);
				}
				else
				{
					each_element.innerText = "Unable to load file.";
				};
			};
			file_request.send();
		};
	};
};

update_content();
update_math();
update_pre();