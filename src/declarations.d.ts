declare module 'shpjs' {
  const shp: (data: string | ArrayBuffer | Buffer) => Promise<any>;
  export default shp;
}
