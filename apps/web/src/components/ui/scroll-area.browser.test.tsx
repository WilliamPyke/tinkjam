import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../../test/render";
import { ScrollArea } from "./scroll-area";

describe("ScrollArea", () => {
  it("leaves Base UI no CSS property to register when it mounts", async () => {
    const register = CSS.registerProperty.bind(CSS);
    const registered: Array<string> = [];
    using registerProperty = vi.spyOn(CSS, "registerProperty").mockImplementation((definition) => {
      register(definition);
      registered.push(definition.name);
    });
    await using _screen = await render(<ScrollArea>Text</ScrollArea>);

    expect(registerProperty).toHaveBeenCalled();
    expect(registered).toEqual([]);
  });
});
