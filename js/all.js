function update_content()
{
	class InlineParser
	{
		constructor(target)
		{
			this.target = target;
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
			this.sections = new Array(target);
			this.tree = new Array();
			this.list = undefined;
			this.id_counter = 0;
			if (nav.querySelector("ol:empty"))
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
			else if (this.list && tabless_content.match(/^- /))
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
			this.id_counter ++;
			let heading_level = content.match(/^#+/)[0].length;
			let heading_text = content.replace(/^#+/, "");
			if (heading_level > this.sections.length)
			{
				console.warn(`Heading level too high.\n at "${content}"`)
				heading_level = this.sections.length;
			};
			this.pop_section(heading_level);
			this.pop_catalogue(heading_level);
			let new_section = this.push_section();
			let new_heading = document.createElement(`h${heading_level + 1 > 6 ? 6 : heading_level + 1}`);
			new_section.appendChild(new_heading);
			let line_parser = new InlineParser(new_heading);
			line_parser.parse(heading_text);
			let heading_id = `#${this.id_counter}`;
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
			this.sections[this.sections.length - 1].appendChild(document.createElement("hr"));
		};
		parse_list(content)
		{
			content = content.match(/^- (.*)/)[1];
			let new_list_item = document.createElement("p");
			let line_parser = new InlineParser(new_list_item);
			if (this.list.classList.contains("input") || this.list.classList.contains("output"))
			{
				line_parser.parse_io_list(content);
			}
			else
			{
				line_parser.parse(content);
			}
			this.list.appendChild(new_list_item);
		};
		parse_tree(content)
		{
			if (content == "-")
			{
				this.tree.length = 0;
				return;
			};
			let indents = content.match(/^( *)/)[0].length + 1;
			let line_content = content.replace(/^ *- /, "");
			if (indents > this.tree.length + 1)
			{
				console.warn(`Tree level too high.\n at "${content}"`)
				indents = this.tree.length + 1;
			};
			if (indents == this.tree.length + 1)
			{
				let sub_tree = document.createElement("ol");
				if (this.tree.length == 0)
				{
					sub_tree.classList.add("tree");
					this.sections[this.sections.length - 1].appendChild(sub_tree);
				}
				else
				{
					this.tree[this.tree.length - 1].lastChild.appendChild(sub_tree);
				};
				this.tree.push(sub_tree);
			};
			let new_line = document.createElement("li");
			let line_parser = new InlineParser(new_line);
			line_parser.parse(` ${line_content}`);
			this.tree[indents - 1].appendChild(new_line);
		};
		parse_list_begin_end(content)
		{
			let list_type = content.match(/^LIST (.+)/)[1];
			switch (list_type)
			{
				case "input":
					let new_io_container = document.createElement("div");
					this.sections[this.sections.length - 1].appendChild(new_io_container);
					new_io_container.classList.add("io");
					this.list = document.createElement("div");
					new_io_container.appendChild(this.list);
					this.list.classList.add("input");
					break;
				case "output":
					let current_io_container = this.sections[this.sections.length - 1].lastChild;
					if (!(current_io_container.firstChild instanceof HTMLDivElement && current_io_container.firstChild.classList.contains("input")))
					{
						console.warn("Output must follows an input");
						break;
					};
					this.list = document.createElement("div");
					current_io_container.appendChild(this.list);
					this.list.classList.add("output");
					break;
				case "end":
					this.list = undefined;
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
			let new_figure = origin_figure.cloneNode(true);
			new_figure.id = "";
			this.sections[this.sections.length - 1].appendChild(new_figure);
		};
		parse_paragraph(content)
		{
			let new_paragraph = document.createElement("p");
			let line_parser = new InlineParser(new_paragraph);
			line_parser.parse(content.replace(/^(NOTE|WARN|DEF) /, ""));
			this.sections[this.sections.length - 1].appendChild(new_paragraph);
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
			this.sections[this.sections.length - 1].appendChild(new_section);
			this.sections.push(new_section);
			return new_section;
		};
		push_catalogue(content = undefined, href = undefined)
		{
			let new_catalogue = document.createElement("ol");
			this.catalogues[this.catalogues.length - 1].lastChild.appendChild(new_catalogue);
			this.catalogues.push(new_catalogue);
			if (content && href)
			{
				let new_catalogue_item = document.createElement("li");
				let new_link = document.createElement("a");
				new_link.href = href;
				new_link.innerText = content;
				new_catalogue_item.appendChild(new_link);
				new_catalogue.appendChild(new_catalogue_item);
			};
			return new_catalogue;
		};
		pop_section(level)
		{
			this.sections = this.sections.slice(0, level);
			return this.sections[level];
		};
		pop_catalogue(level)
		{
			this.catalogues = this.catalogues.slice(0, level);
			return this.catalogues[level];
		};
	};
	let targets = document.getElementsByTagName("main");
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
		if (!nav.lastChild.innerHTML)
		{
			nav.removeChild(nav.lastChild);
		};
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