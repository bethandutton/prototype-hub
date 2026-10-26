export interface Viewport {
  name: string;
  width: number | null;
  height: number | null;
}

export interface ViewportGroup {
  label: string;
  items: Viewport[];
}

export const FILL: Viewport = { name: "Fill the window", width: null, height: null };

export const VIEWPORTS: ViewportGroup[] = [
  {
    label: "Phones",
    items: [
      { name: "iPhone 16 Pro", width: 402, height: 874 },
      { name: "iPhone 16", width: 393, height: 852 },
      { name: "iPhone SE", width: 375, height: 667 },
      { name: "Pixel 9", width: 412, height: 915 },
      { name: "Galaxy S24", width: 360, height: 780 },
    ],
  },
  {
    label: "Tablets",
    items: [
      { name: "iPad Pro 13 in", width: 1032, height: 1376 },
      { name: "iPad Pro 11 in", width: 834, height: 1210 },
      { name: "iPad Air", width: 820, height: 1180 },
      { name: "iPad mini", width: 744, height: 1133 },
      { name: "Surface Pro", width: 912, height: 1368 },
    ],
  },
  {
    label: "Desktops",
    items: [
      FILL,
      { name: "Laptop", width: 1280, height: 800 },
      { name: "MacBook Air 13 in", width: 1470, height: 956 },
      { name: "MacBook Pro 14 in", width: 1512, height: 982 },
      { name: "Desktop", width: 1440, height: 900 },
      { name: "Full HD", width: 1920, height: 1080 },
    ],
  },
];
