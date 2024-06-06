class AnimationHandler
{
	static status_running = Symbol("running");
	static status_finished = Symbol("finished");

	constructor(target)
	{
		this.target = target;
		this._transition_function = undefined;
		this.transition_status = AnimationHandler.status_running;
	};

	set transition_function(func)
	{
		const animation_handler = this;
		this._transition_function = function ()
		{
			func();
			if (animation_handler.transition_status === AnimationHandler.status_running)
			{
				requestAnimationFrame(function (){animation_handler._transition_function()});
			};
		};
		this.target.addEventListener("transitionstart", function (){
			animation_handler.transition_status = AnimationHandler.status_running;
			animation_handler._transition_function();
		});
		this.target.addEventListener("transitionend", function (){
			animation_handler.transition_status = AnimationHandler.status_finished
		});
	};
};