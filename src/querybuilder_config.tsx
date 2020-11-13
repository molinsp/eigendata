/*eslint @typescript-eslint/no-unused-vars: ["off", {"varsIgnorePattern": "^_"}]*/
import {
  BasicConfig,
  // types:
  Types
  //Operators, Widgets, Fields, Config, Types, Conjunctions, Settings, LocaleSettings, Funcs,
} from "react-awesome-query-builder";
//import AntdConfig from 'react-awesome-query-builder/lib/config/antd';
const InitialConfig = BasicConfig; // or BasicConfig or MaterialConfig



//////////////////////////////////////////////////////////////////////


const types: Types = {
  ...InitialConfig.types,
  // examples of  overriding
  number: {
      defaultOperator: "equal",
      //mainWidget: "number",
      valueSources: ['value'],
      widgets: {
        number: {
          operators: [
            "equal",
            "not_equal",
            "less",
            "less_or_equal",
            "greater",
            "greater_or_equal",
            //"between",
            //"not_between",
            "is_empty",
            "is_not_empty",
          ],
        },
        slider: {
          operators: [
            "equal",
            "not_equal",
            "less",
            "less_or_equal",
            "greater",
            "greater_or_equal",
            "is_empty",
            "is_not_empty",
          ],
        },
      },
    },
  date: {
      defaultOperator: "equal",
      //mainWidget: "number",
      valueSources: ['value'],
      widgets: {
        date: {
          operators: [
            "equal",
            "not_equal",
            "less",
            "less_or_equal",
            "greater",
            "greater_or_equal",
            //"between",
            //"not_between",
            //"is_empty",
            //"is_not_empty",
          ],
        },
      },
    },
  time: {
      defaultOperator: "equal",
      //mainWidget: "number",
      valueSources: ['value'],
      widgets: {
        time: {
          operators: [
            "equal",
            "not_equal",
            "less",
            "less_or_equal",
            "greater",
            "greater_or_equal",
            //"between",
            //"not_between",
            //"is_empty",
            //"is_not_empty",
          ],
        },
      },
    },
  datetime: {
      defaultOperator: "equal",
      //mainWidget: "number",
      valueSources: ['value'],
      widgets: {
        datetime: {
          operators: [
            "equal",
            "not_equal",
            "less",
            "less_or_equal",
            "greater",
            "greater_or_equal",
            //"between",
            //"not_between",
            //"is_empty",
            //"is_not_empty",
          ],
        },
      },
    },
};

const customConfig: any = {
  ...InitialConfig,
  types
};

export default customConfig;

