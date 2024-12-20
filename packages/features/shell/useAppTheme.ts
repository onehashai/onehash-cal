import getBrandColours from "@calcom/lib/getBrandColours";
import useTheme from "@calcom/lib/hooks/useTheme";
import useMeQuery from "@calcom/trpc/react/hooks/useMeQuery";
import { useBrandTheme } from "@calcom/ui";

export const useAppTheme = () => {
  const { data: user } = useMeQuery();
  const brandTheme = getBrandColours({
    lightVal: user?.brandColor,
    darkVal: user?.darkBrandColor,
  });
  useBrandTheme(brandTheme);
  useTheme(user?.appTheme);
};
