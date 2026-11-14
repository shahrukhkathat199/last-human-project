import { Composition } from "remotion";
import { LastHumanShort } from "./videos/last-human/Bridge";

export const Root = () => {
  return (
    <>
      <Composition
        id="LastHumanShort"
        component={LastHumanShort}
        durationInFrames={1808}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
    </>
  );
};