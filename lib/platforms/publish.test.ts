import { describe, expect, it } from "vitest";
import { instagramGraphBase, linkedInAuthor, postText } from "@/lib/platforms/publish";

describe("published post copy", () => {
  it("includes the edited description, CTA, and hashtags", () => {
    expect(postText({
      hook: "One clear promise",
      body: "The exact edited description.",
      cta: "Try it today.",
      hashtags: ["#ProductMarketing", "#BuildInPublic"],
    })).toBe("One clear promise\n\nThe exact edited description.\n\nTry it today.\n\n#ProductMarketing #BuildInPublic");
  });
});

describe("Instagram publishing transport", () => {
  it("uses graph.instagram.com for direct Instagram Login grants", () => {
    expect(instagramGraphBase({ accountMetadata: { graphHost: "graph.instagram.com" } }))
      .toBe("https://graph.instagram.com/v25.0");
  });

  it("keeps graph.facebook.com compatibility for legacy Page-linked grants", () => {
    expect(instagramGraphBase({ accountMetadata: { facebookPageId: "page-1" } }))
      .toBe("https://graph.facebook.com/v25.0");
  });
});

describe("LinkedIn publishing destination", () => {
  it("uses the selected company Page author URN", () => {
    expect(linkedInAuthor({
      providerAccountId: "12345",
      accountMetadata: { destinationType: "organization", authorUrn: "urn:li:organization:12345" },
      accountScopes: ["w_organization_social"],
    })).toBe("urn:li:organization:12345");
  });

  it("refuses to publish a company Page post with personal-only permission", () => {
    expect(() => linkedInAuthor({
      providerAccountId: "12345",
      accountMetadata: { destinationType: "organization", authorUrn: "urn:li:organization:12345" },
      accountScopes: ["w_member_social"],
    })).toThrow("missing w_organization_social");
  });
});
