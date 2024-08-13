export namespace nodes
{
	export class NodeGroup extends Array<Node>
	{
		constructor()
		{
			super();
		}
		static from(nodes: ArrayLike<Node>)
		{
			const group: NodeGroup = new NodeGroup();
			group.push(...Array.from(nodes));
			return group;
		}
		public push(...nodes: Node[]): number
		{
			for (const node of nodes)
			{
				if (this[this.length - 1] instanceof Text && node instanceof Text)
					this[this.length - 1].textContent! += node.textContent;
				else
					super.push(node);
			}
			return this.length;
		}
	}
	export function attach(target: Node, elements: Iterable<Node>): void
	{
		for (const each_element of elements)
		{
			target.appendChild(each_element);
		}
	}
	export function math_element<key extends keyof MathMLElementTagNameMap>(name: key): MathMLElementTagNameMap[key]
	{
		return document.createElementNS("http://www.w3.org/1998/Math/MathML", name);
	}
}