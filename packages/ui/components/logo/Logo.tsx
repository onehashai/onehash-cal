import Image from "next/image";

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
  const imageSize = small ? { width: 64, height: 64 } : { width: 20, height: 20 };

  return (
    <h3 className={classNames("logo", inline && "inline", className)}>
      <strong>
        {icon ? (
          <div className="mx-auto dark:invert">
            <Image alt="Cal" title="Cal" src={`${src}?type=icon`} width={36} height={36} />
          </div>
        ) : (
          <Image
            className={classNames("dark:invert")}
            alt="Cal"
            title="Cal"
            src={src}
            width={imageSize.width}
            height={imageSize.height}
          />
        )}
      </strong>
    </h3>
  );
}
