export class Vector
{
	content: number[];
	constructor(list: number[])
	{
		this.content = list;
	}
	get dimensions(): number
	{
		return this.content.length;
	}
	get length(): number
	{
		return Math.sqrt(this.content.reduce((previous, current) => previous + current * current, 0));
	}
	get x(): number
	{
		return this.content[0];
	}
	get y(): number
	{
		return this.content[1];
	}
	get z(): number
	{
		return this.content[2];
	}
	public dot(other_vector: Vector): number | undefined
	{
		if (this.dimensions !== other_vector.dimensions)
		{
			return undefined;
		}
		return this.content.reduce((previous, current, index) => previous + current * other_vector.content[index], 0);
	}
	public cross(other_vector: Vector): Vector | number | undefined
	{
		if (this.dimensions === other_vector.dimensions && other_vector.dimensions === 3)
		{
			return new Vector([
				this.y * other_vector.z - this.z * other_vector.y,
				this.z * other_vector.x - this.x * other_vector.z,
				this.x * other_vector.y - this.y * other_vector.x
			]);
		}
		else if (this.dimensions === other_vector.dimensions && other_vector.dimensions === 2)
		{
			return this.x * other_vector.y - this.y * other_vector.x;
		}
		return undefined;
	}
	public plus(other: Vector): Vector | undefined
	{
		if (this.dimensions !== other.dimensions)
		{
			return undefined;
		}
		return new Vector(this.content.map((current, index) => current + other.content[index]));
	}
	public minus(other: Vector): Vector | undefined
	{
		if (this.dimensions !== other.dimensions)
		{
			return undefined;
		}
		return new Vector(this.content.map((current, index) => current - other.content[index]));
	}
}