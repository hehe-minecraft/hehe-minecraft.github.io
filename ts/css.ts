namespace constant
{
	export enum status
	{
		running,
		finished
	}
}

export class AnimationHandler
{
	private readonly target: HTMLElement;
	private _transition_function?: () => void;
	private _transition_status: constant.status;
	constructor(target: HTMLElement)
	{
		this.target = target;
		this._transition_function = undefined;
		this._transition_status = constant.status.finished;
	}
	public set transition_function(func: () => void)
	{
		const animation_handler = this;
		this._transition_function = function () {
			func();
			if (animation_handler._transition_status === constant.status.running)
				requestAnimationFrame(function (){animation_handler._transition_function?.()});
		};
		this.target.addEventListener("transitionstart", function () {
			animation_handler._transition_status = constant.status.running;
			animation_handler._transition_function?.();
		});
		this.target.addEventListener("transitionend", function () {
			animation_handler._transition_status = constant.status.finished;
		});
	}
	public get transition_status(): constant.status
	{
		return this._transition_status;
	}
}