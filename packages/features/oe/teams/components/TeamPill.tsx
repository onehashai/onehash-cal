import classNames from "classnames";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { MembershipRole } from "@calcom/prisma/enums";

type PillColor = "blue" | "green" | "red" | "orange";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  color?: PillColor;
}

export default function TeamPill(properties: Props) {
  const { color: pillColor, text: displayText, ...remainingProps } = properties;

  const pillClassNames = classNames(
    "text-medium self-center rounded-md px-1.5 py-1 text-xs ltr:mr-1 rtl:ml-1",
    {
      " bg-subtle text-emphasis": !pillColor,
      " bg-info text-info": pillColor === "blue",
      " bg-error text-error ": pillColor === "red",
      " bg-attention text-attention": pillColor === "orange",
    }
  );

  return (
    <div className={pillClassNames} {...remainingProps}>
      {displayText}
    </div>
  );
}

interface TeamRoleProps extends Omit<React.ComponentProps<typeof TeamPill>, "text"> {
  role: MembershipRole;
}

export function TeamRole(roleProperties: TeamRoleProps) {
  const localeHook = useLocale();
  const { role: memberRole, ...additionalProps } = roleProperties;

  const roleColorMapping: Record<MembershipRole, PillColor | undefined> = {
    [MembershipRole.OWNER]: "blue",
    [MembershipRole.ADMIN]: "red",
    [MembershipRole.MEMBER]: undefined,
  };

  const roleText = localeHook.t(memberRole.toLowerCase());
  const roleColor = roleColorMapping[memberRole];

  return <TeamPill text={roleText} color={roleColor} {...additionalProps} />;
}
