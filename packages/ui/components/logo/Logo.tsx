import classNames from "@calcom/lib/classNames";

export default function Logo({
  small,
  icon,
  inline = true,
  className,
  src = "/oh-logo-word.svg",
}: {
  small?: boolean;
  icon?: boolean;
  inline?: boolean;
  className?: string;
  src?: string;
}) {
  return (
    <h3 className={classNames("logo", inline && "inline", className)}>
      <strong>
        {icon ? (
          <div className="mx-auto dark:invert">
            <img alt="Cal ID" title="Cal ID" src={`${src}?type=icon`} />
          </div>
        ) : (
          <img alt="Cal ID" title="Cal ID" src={`${src}?type=icon`} className="h-full w-48" />
        )}
      </strong>
    </h3>
  );
}
