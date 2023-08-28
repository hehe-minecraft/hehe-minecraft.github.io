async function sync(cls, output_event)
{
	await wrap_run(cls, output_event);
};

function wrap_run(cls, output_event)
{
	return new Promise(function (resolve, reject)
	{
		try
		{
			cls.addEventListener(output_event, function (event){resolve(event.target.result)})
		}
		catch (error)
		{
			reject(error);
		};
	});
};
