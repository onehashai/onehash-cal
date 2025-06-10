import classNames from "@calcom/lib/classNames";

export default function Logo({
  small,
  icon,
  inline = true,
  className,
  src = "/api/logo",
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
            <img alt="Cal" title="Cal.id" src={`${src}?type=icon`} />
          </div>
        ) : (
          <img alt="Cal.id" title="Cal.id" src={src} className="h-full w-24" />
        )}
      </strong>
    </h3>
  );
}
