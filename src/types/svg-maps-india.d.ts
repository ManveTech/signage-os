/**
 * The package ships types that import from "svg-maps__common", which it does
 * not depend on — so its own declaration file does not resolve. The shape is
 * small and stable, so it is declared here rather than pulling in another
 * package for one interface.
 */
declare module '@svg-maps/india' {
  export interface IndiaMapLocation {
    id: string;
    name: string;
    path: string;
  }
  const map: {
    label: string;
    viewBox: string;
    locations: IndiaMapLocation[];
  };
  export default map;
}
