class Vector
{
	constructor(list)
	{
		this.content = list;
	};

	get dimensions()
	{
		return this.content.length;
	};

	get length()
	{
		return Math.sqrt(this.content.reduce((previous, current) => previous + current * current, 0));
	};

	get x()
	{
		return this.content[0];
	};

	get y()
	{
		return this.content[1];
	};

	get z()
	{
		return this.content[2];
	};

	dot(other_vector)
	{
		if (this.dimensions !== other_vector.dimensions)
		{
			return undefined;
		};
		return this.content.reduce((previous, current, index) => previous + current * other_vector.content[index], 0);
	};

	cross(other_vector)
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
		};
		return undefined;
	};

	plus(other)
	{
		if (this.dimensions !== other.dimensions)
		{
			return undefined;
		};
		return new Vector(this.content.map((current, index) => current + other.content[index]));
	};

	minus(other)
	{
		if (this.dimensions !== other.dimensions)
		{
			return undefined;
		};
		return new Vector(this.content.map((current, index) => current - other.content[index]));
	}
};