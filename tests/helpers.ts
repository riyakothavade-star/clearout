// A minimal JPEG header: start-of-image, then a start-of-frame segment holding width and height.
export function fakeJpeg(width: number, height: number, extraBytes = 0): string {
  const header = [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03];
  return Buffer.from([...header, ...new Array(20 + extraBytes).fill(0)]).toString("base64");
}
